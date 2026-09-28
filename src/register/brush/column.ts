// Port of legacy `src/brush/column.js` ("chart.brush.column", extend: "chart.brush.bar"). Reuses
// `BarBrush`'s `getBarStyle`/`getBarElement`/`setActiveEffect`/`drawETC`/`static setup()` via real
// TS class inheritance (`extends BarBrush`) - only `drawBefore`/`draw`/`drawAnimate` (the
// orientation-specific pieces) are overridden, exactly matching the legacy `extend` chain's own
// division of labor (column.js defines none of the shared helpers itself).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushSeriesXY } from 'jui-graph-ts'
import { BarBrush } from './bar'
import type { BarBrushOptions } from './bar'

/** `chart.brush.column` has no `setup()` of its own - it inherits `BarBrush`'s
 * `BAR_BRUSH_OWN_DEFAULTS`/`BarBrushOptions` verbatim (only the orientation-specific
 * `drawBefore`/`draw`/`drawAnimate` are overridden). Re-exported under this name purely so a
 * generated doc page for `"column"` has something to point at. */
export type ColumnBrushOptions = BarBrushOptions

export class ColumnBrush extends BarBrush {
  private zeroY = 0
  private width = 0
  private col_width = 0
  private half_width = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const op = brush.outerPadding as number
    const ip = brush.innerPadding as number
    const len = (this.brush.target ?? []).length

    this.g = this.chart.svg.group()
    this.zeroY = (this.axis.y as BrushAxisScale)(0)
    this.width = (this.axis.x as BrushAxisScale).rangeBand!()

    if ((brush.size as number) > 0) {
      this.col_width = brush.size as number
      this.half_width = this.col_width * len + (len - 1) * ip
    } else {
      this.half_width = this.width - op * 2
      this.col_width = (this.width - op * 2 - (len - 1) * ip) / len
      this.col_width = this.col_width < 0 ? 0 : this.col_width
    }
  }

  draw = (): any => {
    const points: BrushSeriesXY[] = this.getXY()
    const style = this.getBarStyle()
    const target = this.brush.target ?? []

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      let startX = this.offset('x', index) - this.half_width / 2

      for (let j = 0; j < target.length; j++) {
        const value = row[target[j]]
        const tooltipX = startX + this.col_width / 2
        let tooltipY = (this.axis.y as BrushAxisScale)(value)
        const position = tooltipY <= this.zeroY ? 'top' : 'bottom'

        const minSize = (this.brush as Record<string, unknown>).minSize as number
        if (Math.abs(this.zeroY - tooltipY) < minSize) {
          tooltipY = position === 'top' ? tooltipY - minSize : tooltipY + minSize
        }

        const height = Math.abs(this.zeroY - tooltipY)
        const radius = this.col_width < style.borderRadius || height < style.borderRadius ? 0 : style.borderRadius

        const r = this.getBarElement(index, j, {
          width: this.col_width,
          height,
          value,
          tooltipX,
          tooltipY,
          position,
          max: points[j].max[index],
          min: points[j].min[index],
        })

        if (tooltipY <= this.zeroY) {
          r.round(this.col_width, height, radius, radius, 0, 0)
          r.translate(startX, tooltipY)
        } else {
          r.round(this.col_width, height, 0, 0, radius, radius)
          r.translate(startX, this.zeroY)
        }

        this.g.append(r)

        startX += this.col_width + ((this.brush as Record<string, unknown>).innerPadding as number)
      }
    })

    this.drawETC(this.g)

    return this.g
  }

  drawAnimate = (root: any): void => {
    const svg = this.chart.svg
    const type = (this.brush as Record<string, unknown>).animate

    root.append(
      svg.animate({
        attributeName: 'opacity',
        from: '0',
        to: '1',
        begin: '0s',
        dur: '1.4s',
        repeatCount: '1',
        fill: 'freeze',
      }),
    )

    root.each((_i: number, elem: any) => {
      // See `bar.ts`'s `drawAnimate()` for the full writeup: `Element.is()` was previously
      // mis-diagnosed as a preserved "always throws" bug - it isn't (confirmed against the real
      // legacy site's `animate: true` demos, none of which throw) - and is now a real,
      // non-throwing registry-backed `instanceof` check, matching the real engine exactly.
      if (elem.is('util.svg.element.path')) {
        const xy = (elem.data('translate') as string).split(',')
        const x = parseInt(xy[0])
        const y = parseInt(xy[1])
        const h = parseInt(elem.attr('height'))
        const start = type === 'top' ? y - h : y + h

        elem.append(
          svg.animateTransform({
            attributeName: 'transform',
            type: 'translate',
            from: x + ' ' + start,
            to: x + ' ' + y,
            begin: '0s',
            dur: '0.7s',
            repeatCount: '1',
            fill: 'freeze',
          }),
        )
      }
    })
  }
}

registerBrush('column', ColumnBrush)
