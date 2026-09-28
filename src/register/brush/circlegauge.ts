// Port of legacy `src/brush/circlegauge.js` ("chart.brush.circlegauge", extend:
// "chart.brush.core") - a minimal "donut-less" gauge: one background circle + one foreground
// circle whose RADIUS (not an arc sweep) is scaled by `(value-min)/(max-min)`, per data row, using
// the same panel-grid `axis.c(i)` -> `{width,height,x,y}` cell projection `fullgauge.ts`/
// `bargauge.ts` already use.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type CAxis = (i: number) => { width: number; height: number; x: number; y: number }

/** `chart.brush.circlegauge`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface CircleGaugeBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `circlegauge.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.circlegauge.setup()` fields - see legacy `circlegauge.js`. */
export const CIRCLEGAUGE_BRUSH_OWN_DEFAULTS: CircleGaugeBrushOptions = {
  clip: false,
}

export class CircleGaugeBrush extends CoreBrush {
  private group: any

  private drawUnit(i: number, data: BrushData): void {
    const obj = (this.axis.c as unknown as CAxis)(i)
    const value = this.getValue(data, 'value', 0) as number
    const max = this.getValue(data, 'max', 100) as number
    const min = this.getValue(data, 'min', 0) as number

    const rate = (value - min) / (max - min)
    const w = Math.min(obj.width, obj.height) / 2
    const centerX = obj.width / 2 + obj.x
    const centerY = obj.height / 2 + obj.y
    const outerRadius = w

    this.group.append(
      this.chart.svg.circle({
        cx: centerX,
        cy: centerY,
        r: outerRadius,
        fill: this.chart.theme('gaugeBackgroundColor'),
        stroke: this.color(0),
        'stroke-width': 2,
      }),
    )

    this.group.append(
      this.chart.svg.circle({
        cx: centerX,
        cy: centerY,
        r: outerRadius * rate,
        fill: this.color(0),
      }),
    )

    // `addEvent()`'s own TS signature doesn't accept a literal `null` `dataIndex` (only `number |
    // BrushData | undefined`) - cast to preserve the legacy call's exact `(group, null, null)`
    // shape (an `undefined`-valued `dataIndex` would set a subtly different `obj.dataIndex`).
    this.addEvent(this.group, null as unknown as undefined, null)
  }

  draw = (): any => {
    this.group = this.chart.svg.group()

    this.eachData((data, i) => {
      this.drawUnit(i as number, data as BrushData)
    })

    return this.group
  }

  static setup(): Record<string, unknown> {
    return CIRCLEGAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('circlegauge', CircleGaugeBrush)
