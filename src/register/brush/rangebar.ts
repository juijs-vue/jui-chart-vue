// Port of legacy `src/brush/rangebar.js` ("chart.brush.rangebar", extend: "chart.brush.core") -
// extends `CoreBrush` DIRECTLY (confirmed from the legacy file's own `extend:` field), shares no
// code with `BarBrush`. Each `brush.target` field holds a `[min, max]` 2-element array per row
// (not a plain number, unlike every other brush in this batch) - renders one horizontal
// range-span rect per target per row.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

/** `chart.brush.rangebar`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions` - each
 * `target` field here holds a `[min, max]` 2-element array per row, not a plain number). */
export interface RangeBarBrushOptions {
  /** Padding reserved at the top/bottom of each row's range-bar group. */
  outerPadding?: number
  /** Gap in px between adjacent range-bars within the same row. */
  innerPadding?: number
}

/** Own `chart.brush.rangebar.setup()` fields - see legacy `rangebar.js`. */
export const RANGE_BAR_BRUSH_OWN_DEFAULTS: RangeBarBrushOptions = {
  outerPadding: 2,
  innerPadding: 1,
}

export class RangeBarBrush extends CoreBrush {
  private g: any
  private half_height = 0
  private bar_height = 0

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. Derives
   * `half_height` (the row band height minus twice `outerPadding`) and `bar_height` (that space
   * split evenly across every target, minus the `innerPadding` gaps between them), so `draw()`
   * can stack each row's per-target range-bars without recomputing this per row. */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const target = this.brush.target ?? []

    this.g = this.chart.svg.group()

    const height = (this.axis.y as BrushAxisScale).rangeBand!()
    this.half_height = height - (brush.outerPadding as number) * 2
    this.bar_height = (this.half_height - (target.length - 1) * (brush.innerPadding as number)) / target.length
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. For each row
   * and each target field (a `[min, max]` tuple), draws one horizontal rect spanning from the
   * `min`-resolved x to the `max`-resolved x (width is the absolute difference, so the tuple's
   * order doesn't need `min <= max`), stacking each target's bar vertically within the row band
   * using the `bar_height`/`half_height` computed in `drawBefore()`. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = this.brush.target ?? []
    const innerPadding = brush.innerPadding as number
    const borderColor = this.chart.theme('barBorderColor')
    const borderWidth = this.chart.theme('barBorderWidth')
    const borderOpacity = this.chart.theme('barBorderOpacity')

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const group = this.chart.svg.group()
      let startY = this.offset('y', index) - this.half_height / 2

      for (let j = 0; j < target.length; j++) {
        const value = row[target[j]] as [unknown, unknown]
        const startX = (this.axis.x as BrushAxisScale)(value[1])
        const zeroX = (this.axis.x as BrushAxisScale)(value[0])

        const r = this.chart.svg.rect({
          x: zeroX,
          y: startY,
          height: this.bar_height,
          width: Math.abs(zeroX - startX),
          fill: this.color(j),
          stroke: borderColor,
          'stroke-width': borderWidth,
          'stroke-opacity': borderOpacity,
        })

        this.addEvent(r, index, j)
        group.append(r)

        startY += this.bar_height + innerPadding
      }

      this.g.append(group)
    })

    return this.g
  }

  /** Returns this brush's own config defaults (`RANGE_BAR_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return RANGE_BAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('rangebar', RangeBarBrush)
