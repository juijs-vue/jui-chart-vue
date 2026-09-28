// Port of legacy `src/brush/ohlc.js` ("chart.brush.ohlc", extend: "chart.brush.candlestick") -
// extends `CandleStickBrush` (confirmed from the legacy file's own `extend:` field) but completely
// overrides `drawBefore()`/`draw()` with its own OHLC ("open-high-low-close") tick-mark rendering
// (a vertical high-low line plus a short left "open" tick and right "close" tick) - reuses nothing
// from the inherited candlestick body-drawing logic, only the `setup()` defaults (`ohlcBorderColor`
// itself, plus `candlestick`'s own theme-driven config, are unchanged - this file adds no new
// `setup()` fields of its own).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'
import { CandleStickBrush } from './candlestick'
import type { CandleStickBrushOptions } from './candlestick'

/** `chart.brush.ohlc` has no `setup()` of its own - it inherits `CandleStickBrush`'s (itself just
 * the base `BrushOptions`, no own fields) verbatim, per the real `extend` chain. Re-exported under
 * this name purely so a future `jui-api-doc` page for `"ohlc"` has something to point at. */
export type OHLCBrushOptions = CandleStickBrushOptions

/**
 * `chart.brush.ohlc`: renders classic OHLC ("open-high-low-close") tick marks - a vertical
 * high-low line plus a short left "open" tick and right "close" tick - per data row. Extends
 * `CandleStickBrush` in name only: it completely replaces `drawBefore()`/`draw()` with its own tick
 * rendering and reuses none of the inherited candlestick-body drawing logic (see this file's own
 * header comment).
 */
export class OHLCBrush extends CandleStickBrush {
  private ohlcG: any

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook - creates
   * this brush's own group (`ohlcG`), completely replacing `CandleStickBrush.drawBefore`'s
   * candlestick-body setup rather than extending it (see this file's header comment). */
  drawBefore = (): void => {
    this.ohlcG = this.chart.svg.group()
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook - fully replaces
   * `CandleStickBrush.draw`. For each row draws a vertical high-low tick line plus a short "open"
   * tick to the left and "close" tick to the right (both offset by `ohlcBorderRadius`), colored
   * with `ohlcInvertBorderColor` when the row closed lower than it opened (`open > close`) or
   * `ohlcBorderColor` otherwise. Only the high-low line gets `addEvent()` wired (the open/close
   * ticks are purely visual). */
  draw = (): any => {
    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const startX = this.offset('x', index)

      const high = this.getValue(row, 'high', 0)
      const low = this.getValue(row, 'low', 0)
      const open = this.getValue(row, 'open', 0)
      const close = this.getValue(row, 'close', 0)

      const color = (open as number) > (close as number) ? this.chart.theme('ohlcInvertBorderColor') : this.chart.theme('ohlcBorderColor')

      const lowHigh = this.chart.svg.line({
        x1: startX,
        y1: (this.axis.y as BrushAxisScale)(high),
        x2: startX,
        y2: (this.axis.y as BrushAxisScale)(low),
        stroke: color,
        'stroke-width': 1,
      })

      const closeLine = this.chart.svg.line({
        x1: startX,
        y1: (this.axis.y as BrushAxisScale)(close),
        x2: startX + (this.chart.theme('ohlcBorderRadius') as number),
        y2: (this.axis.y as BrushAxisScale)(close),
        stroke: color,
        'stroke-width': 1,
      })

      const openLine = this.chart.svg.line({
        x1: startX,
        y1: (this.axis.y as BrushAxisScale)(open),
        x2: startX - (this.chart.theme('ohlcBorderRadius') as number),
        y2: (this.axis.y as BrushAxisScale)(open),
        stroke: color,
        'stroke-width': 1,
      })

      this.addEvent(lowHigh, index, null)

      this.ohlcG.append(lowHigh)
      this.ohlcG.append(closeLine)
      this.ohlcG.append(openLine)
    })

    return this.ohlcG
  }
}

registerBrush('ohlc', OHLCBrush)
