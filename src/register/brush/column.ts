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

/** `chart.brush.column`: the vertical counterpart to `BarBrush` - draws columns, one per target
 * laid out side by side within each row's band, extending outward from the zero y-position with an
 * optional minimum visible length (`minSize`) for near-zero values and rounded outward corners.
 * Extends `BarBrush` and reuses its shared style/tooltip/highlight machinery
 * (`getBarStyle()`/`getBarElement()`/`setActiveEffect()`/`drawETC()`) unchanged, overriding only the
 * orientation-specific `drawBefore()`/`draw()`/`drawAnimate()`. */
export class ColumnBrush extends BarBrush {
  private zeroY = 0
  private width = 0
  private col_width = 0
  private half_width = 0

  /** Vertical counterpart to `BarBrush.drawBefore()`: computes `zeroY` (the y pixel position of
   * value `0`), `width` (the full x-axis row band from `rangeBand()`), and, per `brush.size`,
   * either a fixed `col_width` (with `half_width` the total span of all targets' columns stacked
   * with `innerPadding` gaps) or an auto-computed `col_width` fitting every target into the row
   * width minus `outerPadding` on each side (clamped to `0` rather than going negative). */
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

  /** Vertical counterpart to `BarBrush.draw()`: draws every row's columns, one per target, laid out
   * side by side within the row band using `drawBefore()`'s `col_width`/`half_width`. Each column's
   * length is `|zeroY - tooltipY|`, where `tooltipY` is pushed at least `minSize` away from `zeroY`
   * when it would otherwise be shorter, keeping near-zero values visible/clickable. Corners on the
   * outward end are rounded by `borderRadius` unless the column is too thin or too short. Columns
   * pointing above `zeroY` get their top corners rounded and are translated to their computed top;
   * columns pointing below get their bottom corners rounded and sit at `zeroY`. Finishes by calling
   * the inherited `drawETC()` for tooltips/highlighting. */
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

  /** Vertical counterpart to `BarBrush.drawAnimate()`: fades the whole group in over 1.4s, then
   * slides each rendered column path (identified via `Element.is('util.svg.element.path')`) in from
   * an offset position toward its real `translate()` position over 0.7s. The offset is one column
   * height away, above when `brush.animate === 'top'` and below otherwise. */
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
