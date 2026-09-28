// Port of legacy `src/brush/rangecolumn.js` ("chart.brush.rangecolumn", extend: "chart.brush.core")
// - extends `CoreBrush` DIRECTLY (confirmed from the legacy file's own `extend:` field; NOT
// `RangeBarBrush`/`ColumnBrush` - a fully independent, self-contained sibling). Note: this file's
// theme lookups (`columnBorderColor`/`columnBorderWidth`/`columnBorderOpacity`) reference keys that
// do NOT exist anywhere in the classic theme (verified against the legacy `theme/classic.js` in
// full - only `bar*`/`rateBar*`/etc. border keys exist, no `column*` ones) - a genuine, preserved
// legacy quirk (not a bug introduced by this port): `chart.theme(...)` returns `undefined` for
// these, so the rendered rects get a literal `stroke="undefined"`/etc. attribute. Not "fixed" here.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

/** `chart.brush.rangecolumn`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions` -
 * each `target` field here holds a `[min, max]` 2-element array per row, not a plain number). */
export interface RangeColumnBrushOptions {
  /** Padding reserved at the left/right of each row's range-column group. */
  outerPadding?: number
  /** Gap in px between adjacent range-columns within the same row. */
  innerPadding?: number
}

/** Own `chart.brush.rangecolumn.setup()` fields - see legacy `rangecolumn.js`. */
export const RANGE_COLUMN_BRUSH_OWN_DEFAULTS: RangeColumnBrushOptions = {
  outerPadding: 2,
  innerPadding: 1,
}

export class RangeColumnBrush extends CoreBrush {
  private g: any
  private half_width = 0
  private column_width = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const target = this.brush.target ?? []

    this.g = this.chart.svg.group()

    const width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.half_width = width - (brush.outerPadding as number) * 2
    this.column_width = (width - (brush.outerPadding as number) * 2 - (target.length - 1) * (brush.innerPadding as number)) / target.length
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = this.brush.target ?? []
    const innerPadding = brush.innerPadding as number
    // See header comment: these theme keys don't exist in the classic theme - preserved as-is.
    const borderColor = this.chart.theme('columnBorderColor')
    const borderWidth = this.chart.theme('columnBorderWidth')
    const borderOpacity = this.chart.theme('columnBorderOpacity')

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      let startX = this.offset('x', index) - this.half_width / 2

      for (let j = 0; j < target.length; j++) {
        const value = row[target[j]] as [unknown, unknown]
        const startY = (this.axis.y as BrushAxisScale)(value[1])
        const zeroY = (this.axis.y as BrushAxisScale)(value[0])

        const r = this.chart.svg.rect({
          x: startX,
          y: startY,
          width: this.column_width,
          height: Math.abs(zeroY - startY),
          fill: this.color(j),
          stroke: borderColor,
          'stroke-width': borderWidth,
          'stroke-opacity': borderOpacity,
        })

        this.addEvent(r, index, j)
        this.g.append(r)

        startX += this.column_width + innerPadding
      }
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return RANGE_COLUMN_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('rangecolumn', RangeColumnBrush)
