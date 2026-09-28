// Port of legacy `src/widget/raycast.js` ("chart.widget.raycast", extend: "chart.widget.core") -
// extends `CoreWidget` directly. NOT a visual widget - draws an empty group and instead wires
// `axis.click`/`axis.dblclick`/`axis.rclick` listeners onto one or more configured brushes, each
// re-emitting a `raycast.click`/`raycast.dblclick`/`raycast.rclick` event carrying the specific
// DATA ROW under the cursor - resolved via a cached per-column hit-box (`raycast_area_<col>`,
// written by some OTHER brush/widget via `chart.setCache()` - out of this file's own scope, it
// only ever READS that cache key) intersected against the click position.
//
// **Requires a "block" axis (for the column index) crossed with a "range" axis (for the value)**:
// `setRayCastEvent()` picks whichever of `axis.x`/`axis.y` has `type === "block"` as the row-index
// source and whichever has `type === "range"` as the hit-test source - if NEITHER axis is a
// "block" type, or NEITHER is a "range" type, wiring is silently skipped entirely (no listeners
// registered, `draw()` still returns an empty group) - preserved exactly, not treated as an error.
//
// **Legacy internal name is `DragSelectWidget`, not `RaycastWidget`** - confirmed by reading the
// file: the exported factory's returned constructor is literally named `DragSelectWidget` (almost
// certainly copy-pasted from `dragselect.js` and never renamed) - a real, if cosmetic, upstream
// naming quirk. This port names the TS class `RaycastWidget` (matching its OWN file/registration
// name, not the copy-paste artifact) since TypeScript class names aren't observable the way a
// runtime string-registry key would have been - no behavior is lost either way.
import { CoreWidget, registerWidget } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** `chart.widget.raycast`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface RaycastWidgetOptions {
  /** Which brush(es) to wire click/dblclick/rclick hit-testing onto - a single index or an array
   * of indexes. Each referenced brush's axis must cross a "block"-type axis with a "range"-type
   * axis, or wiring is silently skipped for it. */
  brush?: number | number[]
}

/** Own `chart.widget.raycast.setup()` fields - see legacy `raycast.js`. */
export const RAYCAST_WIDGET_OWN_DEFAULTS: RaycastWidgetOptions = {
  brush: [0],
}

/** `chart.widget.raycast` - not a visual widget (draws an empty group); instead wires
 * `axis.click`/`dblclick`/`rclick` listeners onto one or more configured brushes, each re-emitting
 * a `raycast.click`/`dblclick`/`rclick` event carrying the specific data row under the cursor,
 * resolved via a cached per-column hit-box (`raycast_area_<col>`, written by some other brush/
 * widget) intersected against the click position. Requires the brush's axis to cross a "block"-type
 * axis with a "range"-type axis - see this file's header comment for the silent-skip fallback when
 * that pairing isn't present, and the legacy internal-name quirk this port deliberately doesn't
 * reproduce. */
export class RaycastWidget extends CoreWidget {
  /** Hit-tests a click/dblclick/rclick position against the cached hit-box for the block-axis
   * column under the cursor (`chart.getCache('raycast_area_<col>')`, written by some other brush -
   * see this file's header comment), and if the cursor position actually falls inside that box,
   * re-emits `eventType` (`'raycast.click'`/`'raycast.dblclick'`/`'raycast.rclick'`) carrying the
   * matched data row. `_rangeAxis` is accepted but unused - the hit-box itself already encodes the
   * range-axis bounds, so only `blockAxis.invert()` is needed to find which column/row was hit. */
  private emitBlockAndRangeEvent(
    eventType: string,
    datas: BrushData[],
    brush: Record<string, unknown>,
    blockAxis: { invert(x: number): number },
    _rangeAxis: unknown,
    e: { chartX: number; chartY: number },
  ): void {
    const blockValue = blockAxis.invert(e.chartX) - 1
    const area = this.chart.getCache(`raycast_area_${blockValue}`) as { x1: number; x2: number; y1: number; y2: number } | undefined

    if (area != null) {
      if (e.chartX >= area.x1 && e.chartX <= area.x2 && e.chartY >= area.y1 && e.chartY <= area.y2) {
        this.chart.emit(eventType, [
          {
            brush,
            data: datas[blockValue],
            dataIndex: blockValue,
          },
          e,
        ])
      }
    }
  }

  /** Wires `axis.click`/`axis.dblclick`/`axis.rclick` (scoped to `brush.axis`) for one brush, each
   * delegating to `emitBlockAndRangeEvent()` - but only when the brush's axis actually crosses a
   * "block"-type dimension with a "range"-type one (checked once here via `axis.x`/`axis.y`'s own
   * `type`); when neither pairing is found, this silently registers no listeners at all, per this
   * file's header comment. */
  private setRayCastEvent(brush: Record<string, unknown>): void {
    const axis = this.chart.axis(brush.axis as number)
    const xType = axis.x?.type
    const yType = axis.y?.type
    const blockAxis = xType === 'block' ? axis.x : yType === 'block' ? axis.y : null
    const rangeAxis = xType === 'range' ? axis.x : yType === 'range' ? axis.y : null

    if (blockAxis != null && rangeAxis != null) {
      this.on(
        'axis.click',
        (e: { chartX: number; chartY: number }) => {
          this.emitBlockAndRangeEvent('raycast.click', axis.data, brush, blockAxis, rangeAxis, e)
        },
        brush.axis as number,
      )

      this.on(
        'axis.dblclick',
        (e: { chartX: number; chartY: number }) => {
          this.emitBlockAndRangeEvent('raycast.dblclick', axis.data, brush, blockAxis, rangeAxis, e)
        },
        brush.axis as number,
      )

      this.on(
        'axis.rclick',
        (e: { chartX: number; chartY: number }) => {
          this.emitBlockAndRangeEvent('raycast.rclick', axis.data, brush, blockAxis, rangeAxis, e)
        },
        brush.axis as number,
      )
    }
  }

  /** Wires `setRayCastEvent()` for every brush index in `widget.brush`, and returns an empty group -
   * this widget draws nothing visible of its own (see this file's header comment). */
  draw = (): any => {
    const g = this.chart.svg.group()
    const bIndex = (this.widget as Record<string, unknown>).brush
    const bIndexes = Array.isArray(bIndex) ? bIndex : [bIndex as number]

    for (let i = 0; i < bIndexes.length; i++) {
      const brush = this.chart.get('brush', bIndexes[i])
      this.setRayCastEvent(brush)
    }

    return g
  }

  /** Supplies `RAYCAST_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return RAYCAST_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('raycast', RaycastWidget)
