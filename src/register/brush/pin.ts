// Port of legacy `src/brush/pin.js` ("chart.brush.pin", extend: "chart.brush.core") - extends
// `CoreBrush` directly. Genuinely different from every other brush ported so far: `draw()` never
// calls `this.eachData(...)` at all - it renders exactly ONE marker (an optional text label, a
// downward-pointing triangle "flag", and a vertical line spanning the plot area) at a single x
// position (`axis.x(brush.split)`), not once per data row. Cross-checked against `main` branch's
// `usePin.ts` header comment (independently hand-derived the same translate-chain simplification
// from the same source) - no discrepancies.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

/** `chart.brush.pin`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). Unlike
 * most brushes, this renders exactly one marker (not once per data row) - `split` picks WHERE. */
export interface PinBrushOptions {
  /** Flag/triangle marker size in px. */
  size?: number
  /** X-axis value the single pin marker is positioned at (`axis.x(split)`). */
  split?: number
  /** Formats the label text shown on the pin; the label is only shown when this is a function
   * (a `null` format renders no text at all, not the raw value). */
  format?: ((...args: unknown[]) => unknown) | null
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `pin.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.pin.setup()` fields - see legacy `pin.js`. */
export const PIN_BRUSH_OWN_DEFAULTS: PinBrushOptions = {
  size: 6,
  split: 0,
  format: null,
  clip: false,
}

/**
 * `chart.brush.pin`: unlike every other brush, renders exactly ONE marker - not once per data row -
 * at a single x position (`axis.x(brush.split)`): an optional formatted text label, a
 * downward-pointing triangle "flag", and a vertical line spanning the plot area (see this file's
 * own header comment).
 */
export class PinBrush extends CoreBrush {
  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Renders the
   * brush's single marker at `axis.x(brush.split)` (see this file's header comment - unlike every
   * other brush, this never loops over `axis.data`): an optional centered label (shown only when
   * `format` is a function, formatting the axis value at that x position via `axis.x.invert()`), a
   * downward-pointing triangle flag sized by `size`, and a vertical line spanning from just below
   * the flag down to the bottom of the plot area. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const size = brush.size as number
    const color = this.chart.theme('pinBorderColor')
    const width = this.chart.theme('pinBorderWidth')
    const fontSize = this.chart.theme('pinFontSize') as number
    const paddingY = fontSize / 2
    const startY = this.axis.area('y')
    const showText = typeof brush.format === 'function'

    return this.svg.group({}, () => {
      const d = (this.axis.x as BrushAxisScale)(brush.split)
      const x = d - size / 2

      if (showText) {
        const value = this.format((this.axis.x as BrushAxisScale & { invert(y: number): unknown }).invert(d))

        this.chart
          .text(
            {
              'text-anchor': 'middle',
              'font-size': fontSize,
              fill: this.chart.theme('pinFontColor'),
            },
            value as string,
          )
          .translate(d, startY)
      }

      this.svg
        .polygon({
          fill: color,
        })
        .point(size, startY)
        .point(size / 2, size + startY)
        .point(0, startY)
        .translate(x, paddingY)

      this.svg
        .line({
          stroke: color,
          'stroke-width': width,
          x1: size / 2,
          y1: startY + paddingY,
          x2: size / 2,
          y2: startY + this.axis.area('height'),
        })
        .translate(x, 0)
    })
  }

  /** Returns this brush's own config defaults (`PIN_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return PIN_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('pin', PinBrush)
