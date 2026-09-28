// Port of legacy `src/widget/map/control.js` ("chart.widget.map.control", extend:
// "chart.widget.map.core") - a pan/zoom control panel overlay (4 directional pan buttons + home +
// a zoom in/out button pair with a draggable scroll thumb), driving the map's own
// `axis.updateGrid("map", {...})` + `axis.map.view()`/`.scale()`.
import { registerWidget, MapCoreWidget } from 'jui-graph-ts'

const SCROLL_MIN_Y = 21.5
const SCROLL_MAX_Y = 149

type MapScale = {
  (): { x: number; y: number }
  view(x?: number, y?: number): { x: number; y: number }
  scale(s?: number): number
  size(): { width: number; height: number }
}

interface DragEvent {
  x: number
  y: number
}

/** `chart.widget.map.control`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface MapControlWidgetOptions {
  /** Which edge the control panel is anchored to vertically. */
  orient?: 'top' | 'bottom'
  /** Which end the control panel is anchored to horizontally. */
  align?: 'start' | 'end'
  /** Minimum zoom scale the +/- buttons and scroll thumb clamp to. */
  min?: number
  /** Maximum zoom scale the +/- buttons and scroll thumb clamp to. */
  max?: number
  /** Extra x offset in px, applied after position calculation. */
  dx?: number
  /** Extra y offset in px, applied after position calculation. */
  dy?: number
}

/** Own `chart.widget.map.control.setup()` fields - see legacy `widget/map/control.js`. */
export const MAP_CONTROL_WIDGET_OWN_DEFAULTS: MapControlWidgetOptions = {
  orient: 'top',
  align: 'start',
  min: 1,
  max: 3,
  dx: 5,
  dy: 5,
}

export class MapControlWidget extends MapCoreWidget {
  private scale = 1
  private viewX = 0
  private viewY = 0
  private blockX = 0
  private blockY = 0
  private scrollY = 0
  private btn: Record<string, any> = { top: null, right: null, bottom: null, left: null, home: null, up: null, down: null, thumb: null }

  /** Builds and caches (onto `this.btn[type]`) one square button: a rounded background rect at
   * `opacity`, plus a centered icon `<image>` from `url` when given (a plain draggable handle, e.g.
   * the scroll thumb, otherwise). Positioned at `(x, y)` relative to its own group. */
  private createBtnGroup(type: string, opacity: number, x: number, y: number, url: unknown = null): any {
    this.btn[type] = this.chart.svg
      .group({ cursor: url != null ? 'pointer' : 'move' }, () => {
        this.chart.svg.rect({
          x: 0.5,
          y: 0.5,
          width: 20,
          height: 20,
          rx: 2,
          ry: 2,
          stroke: 0,
          fill: this.chart.theme('mapControlButtonColor'),
          'fill-opacity': opacity,
        })

        if (url != null) {
          this.chart.svg.image({
            x: 4.5,
            y: 4.5,
            width: 11,
            height: 11,
            'xmlns:xlink': 'http://www.w3.org/1999/xlink',
            'xlink:href': url,
            opacity: 0.6,
          })
        }
      })
      .translate(x, y)

    return this.btn[type]
  }

  /** Draws the 6 evenly-spaced horizontal tick lines behind the zoom scroll track (purely
   * decorative - no interaction of its own). */
  private createScrollThumbLines(): any {
    return this.chart.svg.group({}, () => {
      for (let i = 0; i < 6; i++) {
        const y = 22 * i

        this.chart.svg
          .path({
            fill: 'none',
            'stroke-width': 1,
            'stroke-opacity': 0.6,
            stroke: this.chart.theme('mapControlScrollLineColor'),
          })
          .MoveTo(1.5, 41.5 + y)
          .LineTo(18.5, 41.5 + y)
      }
    })
  }

  /** Converts a map zoom `scale` (within `[widget.min, widget.max]`) into the scroll thumb's y
   * position (within `[SCROLL_MIN_Y, SCROLL_MAX_Y]`), via the inherited `getScaleToValue()` -
   * despite that method's own "scale to value" naming, here the roles are inverted: `scale` is
   * passed as the value-domain input and the pixel range as the "scale" output, since the scroll
   * track's pixel axis is inverted relative to zoom level (dragging the thumb UP increases zoom). */
  private getScrollThumbY(scale: number): number {
    const widget = this.widget as Record<string, unknown>
    return this.getScaleToValue(scale, widget.min as number, widget.max as number, SCROLL_MIN_Y, SCROLL_MAX_Y)
  }

  /** Inverse of `getScrollThumbY()`: converts a scroll thumb y position back into a map zoom scale,
   * via the inherited `getValueToScale()`. */
  private getScrollScale(y: number): number {
    const widget = this.widget as Record<string, unknown>
    return this.getValueToScale(y, SCROLL_MIN_Y, SCROLL_MAX_Y, widget.min as number, widget.max as number)
  }

  /** Wires click handlers for the 4 directional pan buttons (each nudges `viewX`/`viewY` by one
   * `blockX`/`blockY` step, `1/10` of the map's own size), the home button (restores the view
   * captured in `drawBefore()`), and the +/- zoom buttons (step `this.scale` by ±0.1, clamped to
   * `[widget.min, widget.max]`). Every handler pushes its change onto the axis via
   * `axis.updateGrid('map', ...)` and, for pan, `axis.map.view()`, or for zoom, `axis.map.scale()`
   * plus repositioning the scroll thumb - then force-renders if a render isn't already pending. */
  private setButtonEvents(): void {
    const originViewX = this.viewX
    const originViewY = this.viewY
    const axis = this.axis as unknown as { updateGrid(type: string, value: unknown): void; map: MapScale }

    const move = (): void => {
      axis.updateGrid('map', { scale: this.scale, viewX: this.viewX, viewY: this.viewY })
      axis.map.view(this.viewX, this.viewY)

      if (!this.chart.isRender()) {
        this.chart.render()
      }
    }

    const zoom = (): void => {
      axis.updateGrid('map', { scale: this.scale, viewX: this.viewX, viewY: this.viewY })

      this.scrollY = this.getScrollThumbY(this.scale)
      axis.map.scale(this.scale)
      this.btn.thumb.translate(0, this.scrollY)

      if (!this.chart.isRender()) {
        this.chart.render()
      }
    }

    this.btn.top.on('click', () => {
      this.viewY -= this.blockY
      move()
    })
    this.btn.right.on('click', () => {
      this.viewX += this.blockX
      move()
    })
    this.btn.bottom.on('click', () => {
      this.viewY += this.blockY
      move()
    })
    this.btn.left.on('click', () => {
      this.viewX -= this.blockX
      move()
    })
    this.btn.home.on('click', () => {
      this.viewX = originViewX
      this.viewY = originViewY
      move()
    })

    const widget = this.widget as Record<string, unknown>

    this.btn.up.on('click', () => {
      if (this.scale > (widget.max as number)) return

      this.scale += 0.1
      zoom()
    })
    this.btn.down.on('click', () => {
      if (this.scale - 0.09 < (widget.min as number)) return

      this.scale -= 0.1
      zoom()
    })
  }

  /** Wires the scroll thumb's own drag behavior (separate from the +/- buttons): `mousedown` on the
   * thumb starts tracking, `mousemove` (on either the thumb or the whole `bar`) clamps the resulting
   * thumb y to `[SCROLL_MIN_Y, SCROLL_MAX_Y]`, converts it back to a zoom scale via
   * `getScrollScale()`, and applies it the same way `setButtonEvents()`'s zoom handlers do;
   * `mouseup`/`mouseout` (on the thumb or the bar) commit the drag by folding the accumulated
   * `moveY` into `this.scrollY`. */
  private setScrollEvent(bar: any): void {
    const axis = this.axis as unknown as { updateGrid(type: string, value: unknown): void; map: MapScale }
    let startY = 0
    let moveY = 0

    const moveThumb = (e: DragEvent): void => {
      if (startY == 0) return
      const sy = this.scrollY + e.y - startY

      if (sy >= SCROLL_MIN_Y && sy <= SCROLL_MAX_Y) {
        moveY = e.y - startY
        this.scale = this.getScrollScale(sy)

        axis.updateGrid('map', { scale: this.scale, viewX: this.viewX, viewY: this.viewY })

        axis.map.scale(this.scale)
        this.btn.thumb.translate(0, this.getScrollThumbY(this.scale))

        if (!this.chart.isRender()) {
          this.chart.render()
        }
      }
    }

    const endMoveThumb = (): void => {
      if (startY == 0) return

      startY = 0
      this.scrollY += moveY
    }

    this.btn.thumb.on('mousedown', (e: DragEvent) => {
      if (startY > 0) return

      startY = e.y
    })

    this.btn.thumb.on('mousemove', moveThumb)
    bar.on('mousemove', moveThumb)

    this.btn.thumb.on('mouseup', endMoveThumb)
    bar.on('mouseup', endMoveThumb)
    bar.on('mouseout', endMoveThumb)
  }

  /** Caches the map's current scale/view (so the home button in `setButtonEvents()` can restore
   * this exact starting point) and derives the pan step size (`blockX`/`blockY`, 1/10 of the map's
   * own width/height) and initial scroll-thumb position (`scrollY`, via `getScrollThumbY()`). */
  drawBefore = (): void => {
    const axis = this.axis as unknown as { map: MapScale }

    this.scale = axis.map.scale()
    this.viewX = axis.map.view().x
    this.viewY = axis.map.view().y
    this.blockX = axis.map.size().width / 10
    this.blockY = axis.map.size().height / 10
    this.scrollY = this.getScrollThumbY(this.scale)
  }

  /** Assembles the full control panel (4 pan buttons + home in the `top` group, the zoom scroll bar
   * + up/down buttons + thumb in the `bottom` group), wires both groups' interactions
   * (`setButtonEvents()`/`setScrollEvent()`), then translates the whole panel into its corner per
   * `widget.orient`/`widget.align` (with hardcoded panel-size offsets, `60`/`273`) plus
   * `widget.dx`/`widget.dy`. */
  draw = (): any => {
    const widget = this.widget as Record<string, unknown>

    const g = this.chart.svg.group({}, () => {
      const top = this.chart.svg.group()
      const bottom = this.chart.svg.group().translate(20, 80)
      const bar = this.chart.svg
        .rect({
          x: 0.5,
          y: 0.5,
          width: 26,
          height: 196,
          rx: 4,
          ry: 4,
          stroke: 0,
          fill: this.chart.theme('mapControlScrollColor'),
          'fill-opacity': 0.15,
        })
        .translate(-3, -3)

      top.append(this.createBtnGroup('left', 0.8, 0, 20, this.chart.theme('mapControlLeftButtonImage')))
      top.append(this.createBtnGroup('right', 0.8, 40, 20, this.chart.theme('mapControlRightButtonImage')))
      top.append(this.createBtnGroup('top', 0.8, 20, 0, this.chart.theme('mapControlTopButtonImage')))
      top.append(this.createBtnGroup('bottom', 0.8, 20, 40, this.chart.theme('mapControlBottomButtonImage')))
      top.append(this.createBtnGroup('home', 0, 20, 20, this.chart.theme('mapControlHomeButtonImage')))

      bottom.append(bar)
      bottom.append(this.createScrollThumbLines())
      bottom.append(this.createBtnGroup('up', 0.8, 0, 0, this.chart.theme('mapControlUpButtonImage')))
      bottom.append(this.createBtnGroup('down', 0.8, 0, 170, this.chart.theme('mapControlDownButtonImage')))
      bottom.append(this.createBtnGroup('thumb', 0.8, 0, this.scrollY))

      this.setButtonEvents()
      this.setScrollEvent(bar)
    })

    const ot = widget.orient
    const ag = widget.align
    const dx = widget.dx as number
    const dy = widget.dy as number
    const x2 = this.axis.area('x2')
    const y2 = this.axis.area('y2')

    if (ot == 'bottom' && ag == 'start') {
      g.translate(dx, y2 - (273 + dy))
    } else if (ot == 'bottom' && ag == 'end') {
      g.translate(x2 - (60 + dx), y2 - (273 + dy))
    } else if (ot == 'top' && ag == 'end') {
      g.translate(x2 - (60 + dx), dy)
    } else {
      g.translate(dx, dy)
    }

    return g
  }

  /** Supplies `MAP_CONTROL_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return MAP_CONTROL_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('map.control', MapControlWidget)
