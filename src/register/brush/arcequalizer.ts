// Port of legacy `src/brush/arcequalizer.js` ("chart.brush.arcequalizer", extend:
// "chart.brush.core") - extends `CoreBrush` directly, genuinely independent from `equalizer.js`/
// `equalizerbar.js`/`equalizercolumn.js`/`pie.js`/`donut.js` despite the naming overlap (confirmed
// from source and cross-checked against `main` branch's `useArcEqualizer.ts` header comment, which
// independently reached the same conclusion). Uses the auto-registered "panel" `axis.c(0)` grid,
// same as `PieBrush`/`BarGaugeBrush`. Splits the full circle into EQUAL angular wedges, one per
// data ROW (`360 / dataCount`, NOT value-weighted like `PieBrush`'s slice angles); within each
// row's wedge, every target stacks radially outward from a fixed inner hole (`textRadius`) as small
// fixed-thickness annular-sector "blocks" (count = `Math.ceil(stackCount * value/maxValue)`, a flat
// ratio-vs-configured-maximum - no leftover/partial-block case, unlike `equalizer.js`'s pixel-fill
// math). `polarToCartesian`/`describeArc` are ported as literal private helpers (not substituted
// with `jui-graph-ts`'s `mathUtil.rotate`/`radian`, even though `main`'s own cross-check confirmed
// they're algebraically equivalent - kept as the legacy engine's own exact formula for byte-level
// fidelity, avoiding any incidental floating-point difference from a differently-shaped equivalent
// computation).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** `chart.brush.arcequalizer`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface ArcEqualizerBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `arcequalizer.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** The value a row's wedge is considered "full" at (its block count reaches `stackCount`): a
   * fixed number, or a function returning one. */
  maxValue?: number | ((...args: unknown[]) => number)
  /** Number of annular-sector "blocks" a fully-lit wedge (value === `maxValue`) is divided into
   * radially. */
  stackCount?: number
  /** Radius in px of the empty center hole each wedge's blocks stack outward from. */
  textRadius?: number
  /** Formats the value shown in each wedge's center label; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.arcequalizer.setup()` fields - see legacy `arcequalizer.js`. */
export const ARC_EQUALIZER_BRUSH_OWN_DEFAULTS: ArcEqualizerBrushOptions = {
  clip: false,
  maxValue: 100,
  stackCount: 25,
  textRadius: 50,
  format: null,
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

export class ArcEqualizerBrush extends CoreBrush {
  private g: any
  private r = 0
  private cx = 0
  private cy = 0
  private stackSize = 0
  private stackAngle = 0
  private dataCount = 0

  private describeArc(radius: number, startAngle: number, endAngle: number): { sx: number; sy: number; ex: number; ey: number; sweep: boolean } {
    if (endAngle - startAngle === 360) {
      endAngle = 359.9
    }

    const start = polarToCartesian(this.cx, this.cy, radius, endAngle)
    const end = polarToCartesian(this.cx, this.cy, radius, startAngle)
    const arcSweep = endAngle - startAngle <= 180 ? false : true

    return {
      sx: end.x,
      sy: end.y,
      ex: start.x,
      ey: start.y,
      sweep: arcSweep,
    }
  }

  private drawPath(p: any, radius: number, startAngle: number, endAngle: number): void {
    const arc1 = this.describeArc(radius, startAngle, endAngle)
    const arc2 = this.describeArc(radius + this.stackSize, startAngle, endAngle)

    p.MoveTo(arc1.sx, arc1.sy)
    p.Arc(radius, radius, 0, arc1.sweep, 1, arc1.ex, arc1.ey)
    p.LineTo(arc2.ex, arc2.ey)
    p.Arc(radius + this.stackSize, radius + this.stackSize, 0, arc2.sweep, 0, arc2.sx, arc2.sy)
    p.LineTo(arc1.sx, arc1.sy)
    p.ClosePath()
  }

  private calculateData(): { total: number; data: number[][] } {
    let total = 0
    const targets = this.brush.target ?? []
    let maxValue = (this.brush as Record<string, unknown>).maxValue as number | ((...args: unknown[]) => number)
    const stackData: number[][] = []

    if (typeof maxValue === 'function') {
      let resolvedMax = 0

      this.eachData((data) => {
        resolvedMax = Math.max(resolvedMax, (maxValue as (...args: unknown[]) => number).call(this, data))
      })

      maxValue = resolvedMax
    }

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      stackData[index] = []

      for (let j = 0; j < targets.length; j++) {
        const key = targets[j]
        const rate = (row[key] as number) / (maxValue as number)

        total += row[key] as number
        stackData[index][j] = Math.ceil(((this.brush as Record<string, unknown>).stackCount as number) * rate)
      }
    })

    if (stackData.length == 0) {
      stackData[0] = []

      for (let j = 0; j < targets.length; j++) {
        stackData[0][j] = j == 0 ? ((this.brush as Record<string, unknown>).stackCount as number) : 0
      }
    }

    return { total, data: stackData }
  }

  drawBefore = (): void => {
    this.g = this.svg.group()

    const area = (this.axis.c as unknown as (i: number) => { width: number; height: number })(0)
    const dist = Math.abs(area.width - area.height)

    this.r = Math.min(area.width, area.height) / 2
    this.cx = this.r + (area.width > area.height ? dist / 2 : 0)
    this.cy = this.r + (area.width < area.height ? dist / 2 : 0)

    this.dataCount = this.listData().length
    this.stackSize = (this.r - ((this.brush as Record<string, unknown>).textRadius as number)) / ((this.brush as Record<string, unknown>).stackCount as number)
    this.stackAngle = 360 / (this.dataCount == 0 ? 1 : this.dataCount)
  }

  draw = (): any => {
    const info = this.calculateData()
    const data = info.data
    const total = info.total

    const stackBorderColor = this.chart.theme('arcEqualizerBorderColor')
    const stackBorderWidth = this.chart.theme('arcEqualizerBorderWidth')
    const textFontSize = this.chart.theme('arcEqualizerFontSize') as number
    const textFontColor = this.chart.theme('arcEqualizerFontColor')
    const textRadius = (this.brush as Record<string, unknown>).textRadius as number

    for (let i = 0; i < data.length; i++) {
      let start = 0

      for (let j = 0; j < data[i].length; j++) {
        const p = this.svg.path({
          fill: this.dataCount == 0 ? this.chart.theme('arcEqualizerBackgroundColor') : this.color(j),
          stroke: stackBorderColor,
          'stroke-width': stackBorderWidth,
        })

        for (let k = start; k < start + data[i][j]; k++) {
          this.drawPath(p, textRadius + k * this.stackSize, i * this.stackAngle, (i + 1) * this.stackAngle)
        }

        start += data[i][j]

        this.addEvent(p, i, j)
        this.g.append(p)
      }
    }

    const text = this.chart
      .text({
        'font-size': textFontSize,
        'text-anchor': 'middle',
        fill: textFontColor,
        x: this.cx,
        y: this.cy,
        dy: textFontSize / 3,
      })
      .text(this.format(total) as string)
    this.g.append(text)

    return this.g
  }

  static setup(): Record<string, unknown> {
    return ARC_EQUALIZER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('arcequalizer', ArcEqualizerBrush)
