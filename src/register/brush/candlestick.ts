// Port of legacy `src/brush/candlestick.js` ("chart.brush.candlestick", extend:
// "chart.brush.core") - extends `CoreBrush` directly. No `static setup()` at all in the legacy
// source (confirmed - the file declares zero options of its own), so this leaf's own `setup()`
// returns `{}`, relying entirely on the (now-fixed) `defineOptions()` chain walk for `CoreBrush`/
// `Draw`'s own defaults. Reads `high`/`low`/`open`/`close` fields directly via `getValue()`
// (defaulting each to `0`) rather than a configured `target` array - unlike every axis-based brush
// so far, `brush.target` is never referenced anywhere in this file.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData, BrushOptions } from 'jui-graph-ts'

/** `chart.brush.candlestick` declares no config fields of its own - see this file's own header
 * comment. Re-exported as an alias for `jui-graph-ts`'s base `BrushOptions` purely so a future
 * `jui-api-doc` page for `"candlestick"` has a named type to point at; it reads `high`/`low`/
 * `open`/`close` directly off each row instead of a configured `target` array. */
export type CandleStickBrushOptions = BrushOptions

/** `chart.brush.candlestick`: draws a classic OHLC candlestick per data row - a thin high-low wick
 * line plus a body rect spanning `open`/`close` - reading `high`/`low`/`open`/`close` directly off
 * each row via `getValue()` rather than a configured `target` array (see this file's own header
 * comment). A bearish candle (`open > close`) is drawn in the theme's "invert" colors, a bullish one
 * in the normal candlestick colors; only the body rect is click/hover-interactive. */
export class CandleStickBrush extends CoreBrush {
  private g: any
  private barWidth = 0
  private barPadding = 0

  /** Computes this render pass's fixed candle geometry from the x-axis's row band width
   * (`rangeBand()`): `barWidth` is 70% of the band (leaving a visible gap between candles) and
   * `barPadding` is half of that, used to center each candle's body rect on its row's x position. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    const width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.barWidth = width * 0.7
    this.barPadding = this.barWidth / 2
  }

  /** Draws one candle per row: a thin high-low wick line plus a body rect spanning open/close,
   * reading `high`/`low`/`open`/`close` directly off each row (defaulting to `0`) rather than a
   * configured `target` array. When `open > close` ("bearish"/down candle) the body is drawn from
   * `open` down to `close` in the invert theme colors; otherwise it's drawn from `close` down to
   * `open` in the normal theme colors - only the body rect gets click/hover events, not the wick. */
  draw = (): any => {
    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const startX = this.offset('x', index)

      const high = this.getValue(row, 'high', 0) as number
      const low = this.getValue(row, 'low', 0) as number
      const open = this.getValue(row, 'open', 0) as number
      const close = this.getValue(row, 'close', 0) as number

      let l: any
      let r: any

      if (open > close) {
        // 시가가 종가보다 높을 때 (Red)
        const y = (this.axis.y as BrushAxisScale)(open)

        l = this.chart.svg.line({
          x1: startX,
          y1: (this.axis.y as BrushAxisScale)(high),
          x2: startX,
          y2: (this.axis.y as BrushAxisScale)(low),
          stroke: this.chart.theme('candlestickInvertBorderColor'),
          'stroke-width': 1,
        })

        r = this.chart.svg.rect({
          x: startX - this.barPadding,
          y,
          width: this.barWidth,
          height: Math.abs((this.axis.y as BrushAxisScale)(close) - y),
          fill: this.chart.theme('candlestickInvertBackgroundColor'),
          stroke: this.chart.theme('candlestickInvertBorderColor'),
          'stroke-width': 1,
        })
      } else {
        const y = (this.axis.y as BrushAxisScale)(close)

        l = this.chart.svg.line({
          x1: startX,
          y1: (this.axis.y as BrushAxisScale)(high),
          x2: startX,
          y2: (this.axis.y as BrushAxisScale)(low),
          stroke: this.chart.theme('candlestickBorderColor'),
          'stroke-width': 1,
        })

        r = this.chart.svg.rect({
          x: startX - this.barPadding,
          y,
          width: this.barWidth,
          height: Math.abs((this.axis.y as BrushAxisScale)(open) - y),
          fill: this.chart.theme('candlestickBackgroundColor'),
          stroke: this.chart.theme('candlestickBorderColor'),
          'stroke-width': 1,
        })
      }

      this.addEvent(r, index, null)

      this.g.append(l)
      this.g.append(r)
    })

    return this.g
  }

  /** Declares no options of its own (see this file's header comment) - returns `{}`, relying
   * entirely on `defineOptions()`'s chain walk for the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return {}
  }
}

registerBrush('candlestick', CandleStickBrush)
