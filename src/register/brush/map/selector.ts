// Port of legacy `src/brush/map/selector.js` ("chart.brush.map.selector", extend:
// "chart.brush.map.core") - a pure event-wiring brush (renders an empty `<g>`, `drawBefore()`
// only): highlights the hovered map path on `map.mouseover`/reverts on `map.mouseout` (unless it's
// the currently "active" path), and - if `brush.activeEvent` is configured (e.g. `"map.click"`) -
// marks whichever path that event fires on as the new "active" one.
import { registerBrush, MapCoreBrush } from 'jui-graph-ts'
import type { MapScale } from 'jui-graph-ts'

/** `chart.brush.map.selector`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface MapSelectorBrushOptions {
  /** Row `id`s whose map path starts highlighted as "active" (immune to hover revert). */
  active?: unknown[]
  /** DOM event name that, when it fires on a map path, marks that path as the new "active" one
   * (reverting the previous active path's fill first). No click-to-select wired up when
   * omitted - only hover highlighting still applies. */
  activeEvent?: string | null
}

/** Own `chart.brush.map.selector.setup()` fields - see legacy `map/selector.js`. */
export const MAP_SELECTOR_BRUSH_OWN_DEFAULTS: MapSelectorBrushOptions = {
  active: [],
  activeEvent: null,
}

export class MapSelectorBrush extends MapCoreBrush {
  private g: any
  private activePath: any = null

  drawBefore = (): void => {
    this.g = this.chart.svg.group()
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    let originFill: unknown = null

    this.on('map.mouseover', (obj: { path: any }) => {
      if (this.activePath == obj.path) return

      originFill = obj.path.styles.fill || obj.path.attributes.fill
      obj.path.css({ fill: this.chart.theme('mapSelectorHoverColor') })
    })

    this.on('map.mouseout', (obj: { path: any }) => {
      if (this.activePath == obj.path) return

      obj.path.css({ fill: originFill })
    })

    if (brush.activeEvent != null) {
      this.on(brush.activeEvent as string, (obj: { path: any }) => {
        this.activePath = obj.path

        ;((this.axis as unknown as Record<string, unknown>).map as unknown as MapScale).each((_id, entry) => {
          entry.path.css({ fill: originFill })
        })

        obj.path.css({ fill: this.chart.theme('mapSelectorActiveColor') })
      })
    }

    if ((brush.active as unknown[]).length > 0) {
      const activePaths: any[] = []
      this.activePath = activePaths
      const axis = this.axis
      const theme = this.chart.theme('mapSelectorActiveColor')

      ;((this.axis as unknown as Record<string, unknown>).map as unknown as MapScale).each((_id, entry) => {
        if (entry.data && (brush.active as unknown[]).includes(axis.getValue(entry.data, 'id'))) {
          activePaths.push(entry.path)

          entry.path.css({ fill: theme })
        }
      })
    }

    return this.g
  }

  static setup(): Record<string, unknown> {
    return MAP_SELECTOR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('map.selector', MapSelectorBrush)
