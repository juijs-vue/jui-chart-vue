// Port of legacy `src/brush/fullstackbar3d.js` ("chart.brush.fullstackbar3d", extend:
// "chart.brush.core") - like `stackbar3d.ts`, but each row's stack is rescaled to fill the FULL
// axis width (percent-of-row, not absolute value) via the rendered x-scale's own `.rate(value,
// sum)`, with an optional `%`-label per segment (`brush.showText`). Base class for
// `fullstackcolumn3d.ts` (`extend: "chart.brush.fullstackbar3d"`), which reuses `drawText()`
// unchanged.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type CAxis = (v: unknown, i: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }
type RateScale = (v: unknown) => number
type RateScaleFull = RateScale & { rate(value: number, max: number): number; max(): number }

/** `chart.brush.fullstackbar3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface FullStackBar3DBrushOptions {
  /** Padding reserved at the top/bottom of each row's 100%-stacked box lane. */
  outerPadding?: number
  /** Shows each segment's percentage-of-row label centered on that segment. */
  showText?: boolean
}

/** Own `chart.brush.fullstackbar3d.setup()` fields - see legacy `fullstackbar3d.js`. */
export const FULLSTACKBAR3D_BRUSH_OWN_DEFAULTS: FullStackBar3DBrushOptions = {
  outerPadding: 10,
  showText: false,
}

export class FullStackBar3DBrush extends CoreBrush {
  protected g: any
  private barHeight = 0
  private zeroXY = { x: 0, y: 0, depth: 0 }

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const height = (this.axis.y as unknown as { rangeBand(): number }).rangeBand()

    this.g = this.chart.svg.group()
    this.barHeight = height - (brush.outerPadding as number) * 2
    this.zeroXY = (this.axis.c as unknown as CAxis)(0, 0)
  }

  drawText(percent: number, x: number, y: number): any {
    return this.chart.text(
      {
        'font-size': this.chart.theme('barFontSize'),
        x,
        y,
        'text-anchor': 'middle',
      },
      `${percent}%`,
    )
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const c = this.axis.c as unknown as CAxis
    const xScale = this.axis.x as unknown as RateScaleFull

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const group = this.chart.svg.group()
      const startY = c(0, index).y - this.barHeight / 2
      let colWidth = 0
      let sum = 0
      const list: number[] = []
      let value: unknown
      let j = 0

      for (j = 0; j < target.length; j++) {
        const w = row[target[j]] as number
        sum += w
        list.push(w)
      }

      for (j = 0; j < target.length; j++) {
        value = row[target[j]]
        const xy = c(value, index)
        const top = Math.sin((this.axis.c as unknown as CScale).radian) * xy.depth
        const width = xScale.rate(list[j], sum)
        const r = this.chart.svg.rect3d(this.color(j), width, this.barHeight, (this.axis.c as unknown as CScale).degree as number, xy.depth)

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        r.translate(this.zeroXY.x + colWidth, startY + top)

        group.append(r)

        if (brush.showText) {
          const p = Math.round((list[j] / sum) * xScale.max())
          const x = colWidth + width / 2
          const y = startY + this.barHeight / 2 + 5

          group.append(this.drawText(p, x, y))
        }

        colWidth += width
      }

      this.addEvent(group, index, j)
      this.g.append(group)
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return FULLSTACKBAR3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('fullstackbar3d', FullStackBar3DBrush)
