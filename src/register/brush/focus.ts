// Port of legacy `src/brush/focus.js` ("chart.brush.focus", extend: "chart.brush.core") - extends
// `CoreBrush` directly. Highlights a range on ONE axis (whichever of x/y is the "range"-typed
// value axis - `grid = (axis.y.type == "range") ? "x" : "y"`, so it works for either a
// horizontal-value or vertical-value chart orientation) with a semi-transparent band and two
// border lines. `brush.start`/`brush.end` default to `-1`/`-1` ("no focus configured" - `draw()`
// returns an empty group in that case, matching `svg.g()`, the alias for `svg.group()`).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

/** `chart.brush.focus`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface FocusBrushOptions {
  /** Start of the highlighted range, in the range-typed axis's own value units. `-1` (with `end`
   * also `-1`) means "no focus configured" - nothing is drawn. */
  start?: number
  /** End of the highlighted range, in the range-typed axis's own value units. */
  end?: number
}

/** Own `chart.brush.focus.setup()` fields - see legacy `focus.js`. */
export const FOCUS_BRUSH_OWN_DEFAULTS: FocusBrushOptions = {
  start: -1,
  end: -1,
}

export class FocusBrush extends CoreBrush {
  // Named `gridAxis`, not the legacy closure var's own name `grid` - `Draw` (this class's real
  // base, via `CoreBrush`) already declares a PUBLIC `grid: any` field of its own (for the
  // sibling `chart.grid.*` family), so a same-named PRIVATE field here would violate TS's
  // visibility-narrowing-across-inheritance rule (TS2415) - pure internal renaming, zero behavior
  // change, same precedent as every other Batch's field-collision rename.
  private gridAxis: 'x' | 'y' = 'y'

  drawFocus(start: number, end: number): any {
    const borderColor = this.chart.theme('focusBorderColor')
    const borderSize = this.chart.theme('focusBorderWidth')
    const bgColor = this.chart.theme('focusBackgroundColor')
    const bgOpacity = this.chart.theme('focusBackgroundOpacity')

    const width = this.axis.area('width')
    const height = this.axis.area('height')
    const x = this.axis.area('x')
    const y = this.axis.area('y')

    return this.svg.group({}, () => {
      if ((this.brush as Record<string, unknown>).hide || this.axis.data.length == 0) return

      const a = this.svg.line({
        stroke: borderColor,
        'stroke-width': borderSize,
        x1: 0,
        y1: 0,
        x2: this.gridAxis == 'x' ? 0 : width,
        y2: this.gridAxis == 'x' ? height : 0,
      })

      const b = this.svg.rect({
        width: this.gridAxis == 'x' ? Math.abs(end - start) : width,
        height: this.gridAxis == 'x' ? height : Math.abs(end - start),
        fill: bgColor,
        opacity: bgOpacity,
      })

      const c = this.svg.line({
        stroke: borderColor,
        'stroke-width': borderSize,
        x1: 0,
        y1: 0,
        x2: this.gridAxis == 'x' ? 0 : width,
        y2: this.gridAxis == 'x' ? height : 0,
      })

      if (this.gridAxis == 'x') {
        a.translate(start, y)
        b.translate(start, y)
        c.translate(end, y)
      } else {
        a.translate(x, start)
        b.translate(x, start)
        c.translate(x, end)
      }
    })
  }

  drawBefore = (): void => {
    this.gridAxis = (this.axis.y as BrushAxisScale).type == 'range' ? 'x' : 'y'
  }

  draw = (): any => {
    let start = 0
    let end = 0
    const brush = this.brush as Record<string, unknown>

    if (brush.start == -1 || brush.end == -1) {
      return this.svg.g()
    }

    const gridScale = (this.axis as unknown as Record<'x' | 'y', BrushAxisScale>)[this.gridAxis]

    if (gridScale.type == 'block') {
      const size = gridScale.rangeBand!()

      start = gridScale(brush.start) - size / 2
      end = gridScale(brush.end) + size / 2
    } else {
      start = gridScale(brush.start)
      end = gridScale(brush.end)
    }

    return this.drawFocus(start, end)
  }

  static setup(): Record<string, unknown> {
    return FOCUS_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('focus', FocusBrush)
