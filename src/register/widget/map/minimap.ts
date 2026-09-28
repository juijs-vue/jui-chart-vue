// Port of legacy `src/widget/map/minimap.js` ("chart.widget.map.minimap", extend:
// "chart.widget.map.core") - renders a small "you are here" thumbnail of the main map (via a
// SEPARATE, detached `Builder` instance rendering the same map path at a smaller scale, exported
// as a data URI `<image>`) with a draggable viewport rectangle overlay.
//
// **`builder(null, {...})`**: the legacy source builds its offscreen thumbnail chart through the
// same global `chart.builder`/`jui.include("chart.builder")` factory every real demo uses,
// called with a `null` selector (its own real `createChartBuilder`-equivalent shim just skips the
// "clear an existing DOM container" step when the selector isn't a real element). This project
// has no such factory/registry to call into (`registerBrush`/`registerWidget`/`registerTheme` are
// the only sanctioned extension points - see `canvas/model3d.ts`'s identical note on
// `jui.include`'s absence) - ported here as a direct `new Builder()` against a plain, NEVER-
// appended-to-`document` `<div>`, which is all the real factory's own `null`-selector path
// amounts to functionally (a detached root the returned `Builder` instance still renders into via
// real DOM APIs, just with nothing displaying it).
import { registerWidget, MapCoreWidget, registerAxis, Axis } from 'jui-graph-ts'
import { GRID_TYPES } from '../../gridTypes'
// `ChartBuilder` (this project's own `Builder` subclass, NOT `jui-graph-ts`'s raw `Builder`) - the
// detached thumbnail chart below configures its own `axis[].map` block, which needs the exact same
// `preprocessMapAxis()`/`createMapConfig()` treatment (and the `mapType` truthy-placeholder) the
// real chart's own `Builder` gets via `Chart.vue`/`index.ts` - see `chartMap.ts`'s header comment.
// Using the raw `Builder` here left this detached instance's `axis(0).map` as literally `null`
// (the same two-bug chain `chartMap.ts` documents), causing `getScaleXY()` below to throw
// `TypeError: Cannot read properties of null (reading 'scale')` - which, uncaught, aborted this
// whole widget's `draw()` and, transitively, the ENTIRE chart's `render()` (confirmed via
// Playwright against the real `worldmap7` "Mini Map" demo: with the raw `Builder`, the chart's
// `<svg>` ends up completely empty, not just missing the minimap).
import { ChartBuilder } from '../../chartMap'

type MapScale = {
  (): { x: number; y: number }
  view(x?: number, y?: number): { x: number; y: number }
  scale(s?: number): number
}

interface MapConfig {
  path: string
  width: number
  height: number
  scale?: number
}

interface DragEvent {
  x: number
  y: number
}

/** `chart.widget.map.minimap`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface MapMinimapWidgetOptions {
  /** Which end the minimap is anchored to horizontally. */
  align?: 'start' | 'end'
  /** Which edge the minimap is anchored to vertically. */
  orient?: 'top' | 'bottom'
  /** Scale of the thumbnail map relative to the real map's own path dimensions. */
  scale?: number
  /** Extra x offset in px, applied after position calculation. */
  dx?: number
  /** Extra y offset in px, applied after position calculation. */
  dy?: number
}

/** Own `chart.widget.map.minimap.setup()` fields - see legacy `widget/map/minimap.js`. */
export const MAP_MINIMAP_WIDGET_OWN_DEFAULTS: MapMinimapWidgetOptions = {
  align: 'end',
  orient: 'top',
  scale: 0.2,
  dx: -1,
  dy: 1,
}

export class MapMinimapWidget extends MapCoreWidget {
  private viewX = 0
  private viewY = 0
  private scale = 0

  private getScaleXY(axis: { map: MapScale; get(key: string): unknown }): { x: number; y: number } {
    const s = axis.map.scale()
    const map = axis.get('map') as MapConfig
    const w = map.width
    const h = map.height
    const px = (w * s - w) / 2
    const py = (h * s - h) / 2

    return { x: px, y: py }
  }

  createMapImage(): any {
    const map = (this.axis as unknown as { get(key: string): unknown }).get('map') as MapConfig
    const scale = (this.widget as Record<string, unknown>).scale as number

    // `registerAxis` is idempotent in this codebase's own registered-map guard (`register/
    // setup.ts` already calls it once for the whole app) - safe to call again for this detached
    // instance, since it's the same global registry `jui-graph-ts` itself keeps.
    registerAxis(Axis as unknown as Parameters<typeof registerAxis>[0])

    const image = new ChartBuilder()
    Object.assign(image, { gridTypes: GRID_TYPES })
    image.mount(document.createElement('div'), {
      width: map.width * scale,
      height: map.height * scale,
      padding: 0,
      axis: [
        {
          map: {
            path: map.path,
            width: map.width,
            height: map.height,
            scale,
          },
        },
      ],
      style: {
        backgroundColor: 'transparent',
        mapPathBackgroundColor: this.chart.theme('mapMinimapPathBackgroundColor'),
        mapPathBackgroundOpacity: this.chart.theme('mapMinimapPathBackgroundOpacity'),
        mapPathBorderColor: this.chart.theme('mapMinimapPathBorderColor'),
        mapPathBorderWidth: this.chart.theme('mapMinimapPathBorderWidth'),
        mapPathBorderOpacity: this.chart.theme('mapMinimapPathBorderOpacity'),
      },
    } as never)

    const dxy = this.getScaleXY(image.axis(0) as unknown as { map: MapScale; get(key: string): unknown })
    ;(image.axis(0) as unknown as { map: MapScale }).map.view(-dxy.x, -dxy.y)

    return this.svg.image({
      width: map.width * scale,
      height: map.height * scale,
      'xlink:href': (image.svg as unknown as { toDataURI(): string }).toDataURI(),
    })
  }

  createCtrlButton(attr: Record<string, number>): any {
    const area = (this.axis as unknown as { get(key: string): unknown }).get('area') as { width: number; height: number }
    const map = (this.axis as unknown as { get(key: string): unknown }).get('map') as MapConfig
    let startX = 0
    let startY = 0
    let moveX = 0
    let moveY = 0

    const widget = this.widget as Record<string, unknown>
    const xy = this.getScaleXY(this.axis as unknown as { map: MapScale; get(key: string): unknown })
    let w = attr.width / this.scale
    let h = attr.height / this.scale
    const x = (xy.x / this.scale) * (widget.scale as number)
    const y = (xy.y / this.scale) * (widget.scale as number)
    const dx = (this.viewX / this.scale) * (widget.scale as number)
    const dy = (this.viewY / this.scale) * (widget.scale as number)

    w = w * (area.width / map.width)
    h = h * (area.height / map.width)

    const rect = this.svg.rect({
      stroke: this.chart.theme('mapMinimapDragBorderColor'),
      'stroke-width': this.chart.theme('mapMinimapDragBorderWidth'),
      fill: this.chart.theme('mapMinimapDragBackgroundColor'),
      'fill-opacity': this.chart.theme('mapMinimapDragBackgroundOpacity'),
      cursor: 'move',
      width: w,
      height: h,
      x: x + dx,
      y: y + dy,
    })

    const moveButton = (e: DragEvent): void => {
      if (!startX || !startY) return

      const sx = e.x - startX
      const sy = e.y - startY
      const tx = sx + x + dx
      const ty = sy + y + dy

      if (tx >= 0 && ty >= 0 && tx + w < attr.width && ty + h < attr.height) {
        moveX = sx
        moveY = sy

        rect.translate(moveX, moveY)
      }
    }

    const endMoveButton = (): void => {
      if (!startX || !startY) return

      startX = 0
      startY = 0

      const newViewX = (moveX * this.scale) / (widget.scale as number) + this.viewX
      const newViewY = (moveY * this.scale) / (widget.scale as number) + this.viewY

      ;(this.axis as unknown as { updateGrid(type: string, value: unknown): void }).updateGrid('map', {
        viewX: newViewX,
        viewY: newViewY,
      })
      ;(this.axis as unknown as { map: MapScale }).map.view(newViewX, newViewY)

      if (!this.chart.isRender()) {
        this.chart.render()
      }
    }

    rect.on('mousedown', (e: DragEvent) => {
      if (startX || startY) return

      startX = e.x - moveX
      startY = e.y - moveY
    })

    rect.on('mousemove', moveButton)
    rect.on('mouseup', endMoveButton)
    rect.on('mouseout', endMoveButton)

    return rect
  }

  drawBefore = (): void => {
    const axis = this.axis as unknown as { map: MapScale }
    this.viewX = axis.map.view().x
    this.viewY = axis.map.view().y
    this.scale = axis.map.scale()
  }

  draw = (): any => {
    const widget = this.widget as Record<string, unknown>
    const g = this.svg.group()
    const map = this.createMapImage()
    const btn = this.createCtrlButton(map.attributes)
    const dx = widget.align == 'start' ? 0 : this.chart.area('width') - map.attributes.width
    const dy = widget.orient == 'bottom' ? this.chart.area('height') - map.attributes.height : 0

    g.append(
      this.svg.rect({
        x: 0,
        y: 0,
        width: map.attributes.width,
        height: map.attributes.height,
        fill: this.chart.theme('mapMinimapBackgroundColor'),
        stroke: this.chart.theme('mapMinimapBorderColor'),
        'stroke-width': this.chart.theme('mapMinimapBorderWidth'),
      }),
    )

    g.append(map)
    g.append(btn)
    g.translate(dx + (widget.dx as number), dy + (widget.dy as number))

    return g
  }

  static setup(): Record<string, unknown> {
    return MAP_MINIMAP_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('map.minimap', MapMinimapWidget)
