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

  /** Creates the (always-empty) render group - this brush's whole effect is event wiring done in
   * `draw()`, per this file's own header comment. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
  }

  /** Wires the map's hover/click-to-select behavior; renders no visible shapes of its own (returns
   * the empty group from `drawBefore()`). `map.mouseover` records the hovered path's current fill
   * into the closure-local `originFill` and recolors it to `mapSelectorHoverColor`; `map.mouseout`
   * restores that same `originFill`. Both skip a path that's currently `this.activePath` - but see
   * the PRESERVED BUG below, this only actually protects a path selected via `activeEvent`, not one
   * from the initial `active` list. When `brush.activeEvent` is configured, that event marks its
   * path as the new `activePath`, colors every OTHER map path (via `axis.map.each()`) back to
   * `originFill`, and colors the newly active path `mapSelectorActiveColor`. PRESERVED BUG (also
   * present in the legacy source): that revert uses the single most-recent `originFill` value from
   * whichever path was last hovered, not each path's own individual original fill - so if paths
   * have different original colors, activating a new selection can leave other paths repainted with
   * the wrong color. Finally, when `brush.active` lists any ids, every matching map path is colored
   * `mapSelectorActiveColor` up front and `this.activePath` is set to the ARRAY of those paths -
   * ANOTHER PRESERVED BUG: the hover handlers' `this.activePath == obj.path` check compares a single
   * path object against that array, which is never `==` true, so hover-revert immunity never
   * actually applies to any path from this initial `active` list (only to a path chosen afterward
   * via `activeEvent`, which overwrites `activePath` with a single path object). */
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

  /** Returns this brush's own default options (`active`/`activeEvent`), merged by
   * `defineOptions()` on top of `MapCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return MAP_SELECTOR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('map.selector', MapSelectorBrush)
