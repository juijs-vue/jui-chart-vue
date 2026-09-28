// Port of legacy `src/brush/bargauge.js` ("chart.brush.bargauge", extend: "chart.brush.core") -
// extends `CoreBrush` DIRECTLY. Despite the name pairing "bar" with "gauge", this never touches
// `axis.x`/`axis.y` at all - it reads `axis.c(0)` once (the auto-registered "panel" grid's full
// plot-area rect, same mechanism `PieBrush` uses) and stacks one horizontal bar per DATA ROW
// underneath it (`y += brush.size + brush.cut` per row) - a LIST of independent value-vs-range
// bars, one per `data` row, not one gauge for one value.
//
// Preserved quirks, ported literally (not "fixed" - see legacy `bargauge.js`'s own `draw()`): `min`
// is only ever used as part of the fill width's divisor (the range span) - a nonzero `min` does
// NOT shift where a bar visually starts. The background "track" rect (`x: x + cut`) and the
// foreground "fill" rect (`x: x`) are not drawn from the same left edge, and the track's width
// reuses the fill's own `width` variable (not `width - cut`), so its right edge overshoots the
// cell's own right edge by `cut` px whenever the cell's own `x`/width make that visible.
import { CoreBrush, registerBrush } from 'jui-graph-ts'

/** `chart.brush.bargauge`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`).
 * `min`/`max` per bar come from each DATA row instead (`getValue(row, 'min'|'max', ...)`), not
 * from this brush config. */
export interface BarGaugeBrushOptions {
  /** Gap in px between the track/fill bars' offset and between stacked rows (see this file's
   * header comment for the exact, slightly-quirky left-edge/width math). */
  cut?: number
  /** Bar height in px, and the vertical step between stacked rows. */
  size?: number
  /** Formats the value shown per bar; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.bargauge.setup()` fields - see legacy `bargauge.js`. */
export const BAR_GAUGE_BRUSH_OWN_DEFAULTS: BarGaugeBrushOptions = {
  cut: 5,
  size: 20,
  format: null,
}

export class BarGaugeBrush extends CoreBrush {
  draw = (): any => {
    const group = this.chart.svg.group()
    const brush = this.brush as Record<string, unknown>

    const obj = (this.axis.c as unknown as (i: number) => { width: number; height: number; x: number; y: number })(0)
    const width = obj.width
    const x = obj.x
    let y = obj.y

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const g = this.chart.svg.group()
      const v = this.getValue(row, 'value', 0) as number
      const t = this.getValue(row, 'title', '') as string
      const max = this.getValue(row, 'max', 100) as number
      const min = this.getValue(row, 'min', 0) as number

      const value = (width / (max - min)) * v
      const textY = y + (brush.size as number) / 2 + (brush.cut as number) - 1

      g.append(
        this.chart.svg.rect({
          x: x + (brush.cut as number),
          y,
          width,
          height: brush.size,
          fill: this.chart.theme('bargaugeBackgroundColor'),
        }),
      )

      g.append(
        this.chart.svg.rect({
          x,
          y,
          width: value,
          height: brush.size,
          fill: this.chart.color(index),
        }),
      )

      g.append(
        this.chart.text(
          {
            x: x + (brush.cut as number),
            y: textY,
            'text-anchor': 'start',
            'font-size': this.chart.theme('bargaugeFontSize'),
            fill: this.chart.theme('bargaugeFontColor'),
          },
          t,
        ),
      )

      g.append(
        this.chart.text(
          {
            x: width - (brush.cut as number),
            y: textY,
            'text-anchor': 'end',
            'font-size': this.chart.theme('bargaugeFontSize'),
            fill: this.chart.theme('bargaugeFontColor'),
          },
          this.format(v, index) as string,
        ),
      )

      this.addEvent(g, index, null)
      group.append(g)

      y += (brush.size as number) + (brush.cut as number)
    })

    return group
  }

  static setup(): Record<string, unknown> {
    return BAR_GAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('bargauge', BarGaugeBrush)
