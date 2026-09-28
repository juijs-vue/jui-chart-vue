// Port of legacy `src/brush/fullgauge.js` ("chart.brush.fullgauge", extend: "chart.brush.donut") -
// extends `DonutBrush` (confirmed from the legacy file's own `extend:` field - NOT `PieBrush`
// directly). Completely overrides `draw()`/`drawUnit()` with its own (`drawUnit` here takes only
// `(index, data)`, a DIFFERENT signature than `DonutBrush`'s own 3-param `drawUnit(index, data,
// g)` - a deliberate, unrelated override, not a compatibility requirement, since `draw()` is also
// fully overridden here and never calls the inherited 3-param version). Reuses only `drawDonut()`
// (unmodified) from the `Donut -> Pie` chain. Renders ONE ring-gauge per data row (via `axis.c(i)`,
// the same auto-registered "panel" grid every pie-family brush uses), each showing a background
// track ring, a value-proportional foreground arc, and optional value/title text labels.
import { registerBrush } from 'jui-graph-ts'
import { mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { DonutBrush } from './donut'
import type { DonutBrushOptions } from './donut'

/** `chart.brush.fullgauge`'s own config fields (on top of the inherited `DonutBrushOptions` -
 * `size` is redeclared here as each ring-gauge's stroke width, and `showText` here is a plain
 * boolean rather than `PieBrushOptions`'s `'inside' | 'outside' | null`). */
export interface FullGaugeBrushOptions extends Omit<DonutBrushOptions, 'size' | 'showText'> {
  /** Arc line-cap style: flat (`'butt'`) or rounded (`'round'`) ends. */
  symbol?: 'butt' | 'round'
  /** Stroke width of each ring-gauge's track/value arc in px. */
  size?: number
  /** Start angle in degrees of each ring's arc. */
  startAngle?: number
  /** End angle in degrees of each ring's arc (an angular span from `startAngle`, not an absolute
   * end - `360` draws a full circle). */
  endAngle?: number
  /** Shows the value/title text labels inside each ring. */
  showText?: boolean
  /** X offset in px for the title label, relative to its default centered position. */
  titleX?: number
  /** Y offset in px for the title label, relative to its default centered position. */
  titleY?: number
  /** Formats the value shown in each ring's center label; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.fullgauge.setup()` fields - see legacy `fullgauge.js`. */
export const FULL_GAUGE_BRUSH_OWN_DEFAULTS: FullGaugeBrushOptions = {
  symbol: 'butt',
  size: 60,
  startAngle: 0,
  endAngle: 360,
  showText: true,
  titleX: 0,
  titleY: 0,
  format: null,
}

export class FullGaugeBrush extends DonutBrush {
  private group: any

  createText(value: unknown, index: number, centerX: number, centerY: number, textScale: number): any {
    const g = this.svg.group().translate(centerX, centerY)
    const size = this.chart.theme('gaugeFontSize') as number

    g.append(
      this.chart
        .text(
          {
            'text-anchor': 'middle',
            'font-size': size,
            'font-weight': this.chart.theme('gaugeFontWeight'),
            fill: this.color(index),
            y: size / 3,
          },
          this.format(value, index) as string,
        )
        .scale(textScale),
    )

    return g
  }

  // `index` is a confirmed-dead legacy parameter (legacy `createTitle(title, index, centerX,
  // centerY, dx, dy, textScale)` never reads it in its own body) - kept in the signature (matching
  // the real call-site argument order/count) but prefixed `_` to satisfy `noUnusedParameters`.
  createTitle(title: unknown, _index: number, centerX: number, centerY: number, dx: number, dy: number, textScale: number): any {
    const g = this.svg.group().translate(centerX + dx, centerY + dy)
    const anchor = dx == 0 ? 'middle' : dx < 0 ? 'end' : 'start'
    const size = this.chart.theme('gaugeTitleFontSize') as number

    g.append(
      this.chart
        .text(
          {
            'text-anchor': anchor,
            'font-size': size,
            'font-weight': this.chart.theme('gaugeTitleFontWeight'),
            fill: this.chart.theme('gaugeTitleFontColor'),
            y: size / 3,
          },
          title as string,
        )
        .scale(textScale),
    )

    return g
  }

  drawUnit(index: number, data: unknown): void {
    const row = data as BrushData
    const obj = (this.axis.c as unknown as (i: number) => { width: number; height: number; x: number; y: number })(index)
    const value = this.getValue(row, 'value', 0) as number
    const title = this.getValue(row, 'title', undefined)
    const max = this.getValue(row, 'max', 100) as number
    const min = this.getValue(row, 'min', 0) as number

    const brush = this.brush as Record<string, unknown>
    const startAngle = brush.startAngle as number
    let endAngle = brush.endAngle as number

    if (endAngle >= 360) {
      endAngle = 359.99999
    }

    const rate = (value - min) / (max - min)
    let currentAngle = endAngle * rate

    if (currentAngle > endAngle) {
      currentAngle = endAngle
    }

    const width = obj.width
    const height = obj.height
    const x = obj.x
    const y = obj.y

    const w = Math.min(width, height) / 2
    const centerX = width / 2 + x
    const centerY = height / 2 + y
    const outerRadius = w - (brush.size as number)
    const innerRadius = outerRadius - (brush.size as number)
    const textScale = mathUtil.scaleValue(w, 40, 400, 1, 1.5)

    const paddingAngle = brush.symbol == 'butt' ? (this.chart.theme('gaugePaddingAngle') as number) : 0

    this.group.append(
      this.drawDonut(centerX, centerY, innerRadius, outerRadius, startAngle + currentAngle + paddingAngle, endAngle - currentAngle - paddingAngle * 2, {
        stroke: this.chart.theme('gaugeBackgroundColor'),
        fill: 'transparent',
      }),
    )

    this.group.append(
      this.drawDonut(centerX, centerY, innerRadius, outerRadius, startAngle, currentAngle, {
        stroke: this.color(index),
        'stroke-linecap': brush.symbol,
        fill: 'transparent',
      }),
    )

    if (brush.showText) {
      this.group.append(this.createText(value, index, centerX, centerY - outerRadius * 0.1, textScale))
    }

    if (title != '') {
      this.group.append(this.createTitle(title, index, centerX, centerY - outerRadius * 0.1, brush.titleX as number, brush.titleY as number, textScale))
    }
  }

  draw = (): any => {
    this.group = this.chart.svg.group()

    this.eachData((data, i) => {
      this.drawUnit(i as number, data)
    })

    return this.group
  }

  static setup(): Record<string, unknown> {
    return FULL_GAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('fullgauge', FullGaugeBrush)
