// Port of legacy `src/brush/waterfall.js` ("chart.brush.waterfall", extend: "chart.brush.core") -
// a classic "waterfall" bridge chart: the first (and, if `end: true`, last) column is a full
// edge-colored bar from the axis's own zero line; every column in between is a floating segment
// between the PREVIOUS row's value and this row's value (colored one way when rising, another when
// falling), optionally connected to the next segment by a dashed guide line.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.waterfall`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface WaterfallBrushOptions {
  /** Draws a dashed guide line connecting each floating segment's top edge to the next column. */
  line?: boolean
  /** Renders the LAST column as a full edge-colored bar from zero too (like the first column),
   * instead of a floating segment. */
  end?: boolean
  /** Horizontal gap in px reserved on each side of every column's band, before the column itself
   * is drawn within the remaining width. */
  outerPadding?: number
}

/** Own `chart.brush.waterfall.setup()` fields - see legacy `waterfall.js`. */
export const WATERFALL_BRUSH_OWN_DEFAULTS: WaterfallBrushOptions = {
  line: true,
  end: false,
  outerPadding: 5,
}

export class WaterfallBrush extends CoreBrush {
  private g: any
  private count = 0
  private zeroY = 0
  private width = 0
  private columnWidth = 0
  private halfWidth = 0
  private outerPadding = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]

    this.g = this.chart.svg.group()

    this.outerPadding = brush.outerPadding as number
    this.count = this.listData().length
    this.zeroY = (this.axis.y as BrushAxisScale)(0)

    this.width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.halfWidth = this.width - this.outerPadding * 2
    this.columnWidth = (this.width - this.outerPadding * 2 - (target.length - 1)) / target.length
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = ((brush.target ?? []) as string[])[0]
    const stroke = this.chart.theme('waterfallLineColor')

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      let startX = this.offset('x', index) - this.halfWidth / 2
      const startY = (this.axis.y as BrushAxisScale)(row[target])
      let r: any = null

      if (index == 0 || (index == this.count - 1 && brush.end)) {
        const color = this.chart.theme('waterfallEdgeBackgroundColor')

        if (startY <= this.zeroY) {
          r = this.chart.svg.rect({ x: startX, y: startY, width: this.columnWidth, height: Math.abs(this.zeroY - startY), fill: color })
        } else {
          r = this.chart.svg.rect({ x: startX, y: this.zeroY, width: this.columnWidth, height: Math.abs(this.zeroY - startY), fill: color })
        }
      } else {
        const preValue = (this.getData(index - 1) as BrushData)[target]
        const nowValue = row[target]
        const preStartY = (this.axis.y as BrushAxisScale)(preValue)
        const nowStartY = (this.axis.y as BrushAxisScale)(nowValue)
        const h = preStartY - nowStartY

        if (h > 0) {
          r = this.chart.svg.rect({ x: startX, y: preStartY - h, width: this.columnWidth, height: Math.abs(h), fill: this.chart.theme('waterfallBackgroundColor') })
        } else {
          r = this.chart.svg.rect({ x: startX, y: preStartY, width: this.columnWidth, height: Math.abs(h), fill: this.chart.theme('waterfallInvertBackgroundColor') })
        }

        if (brush.line) {
          const l = this.chart.svg.line({
            x1: startX - this.outerPadding * 2,
            y1: nowStartY + h,
            x2: startX,
            y2: nowStartY + h,
            stroke,
            'stroke-width': 1,
            'stroke-dasharray': this.chart.theme('waterfallLineDashArray'),
          })

          this.g.append(l)
        }
      }

      this.addEvent(r, index, 0)
      this.g.append(r)

      startX += this.columnWidth
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return WATERFALL_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('waterfall', WaterfallBrush)
