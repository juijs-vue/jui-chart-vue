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

/** `chart.brush.fullstackbar3d`: the pseudo-3D counterpart to `FullStackBarBrush` - each row's
 * isometric-extruded box stack is rescaled to fill the full axis width (each target's box width from
 * `xScale.rate(list[j], sum)`, its share of that row's own value sum) rather than absolute values,
 * with an optional percentage label per segment (`brush.showText`, via the new `drawText()`, reused
 * unchanged by `FullStackColumn3DBrush`). Serves as the base class for
 * `FullStackColumn3DBrush`/`fullstackcolumn3d.ts`. */
export class FullStackBar3DBrush extends CoreBrush {
  protected g: any
  private barHeight = 0
  private zeroXY = { x: 0, y: 0, depth: 0 }

  /** Computes this render pass's shared geometry: `barHeight` (the y-axis row band minus twice
   * `outerPadding`) and `zeroXY` (the "grid3d" axis's projection of value `0` at row `0`, used as
   * every row's shared x/depth origin since a 100%-stacked row always starts at the same place). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const height = (this.axis.y as unknown as { rangeBand(): number }).rangeBand()

    this.g = this.chart.svg.group()
    this.barHeight = height - (brush.outerPadding as number) * 2
    this.zeroXY = (this.axis.c as unknown as CAxis)(0, 0)
  }

  /** Builds one segment's `"<percent>%"` label centered at `(x, y)`. New in `FullStackBar3DBrush`,
   * reused unchanged by `FullStackColumn3DBrush`. */
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

  /** Draws every row's 100%-normalized 3D box stack: each target's box width comes from
   * `xScale.rate(list[j], sum)` - its share of THAT ROW's own value sum, not the axis's global max
   * - so every row's stack always spans the same total width regardless of its raw totals, same
   * normalization as `fullstackbar.ts`'s 2D version. Boxes are placed left-to-right from the shared
   * `zeroXY.x` origin, each shifted vertically by the isometric depth compensation (`sin(radian) *
   * depth`). Click/hover events are skipped for exactly-zero values per-box, but the row's whole
   * `group` also gets its own `addEvent(group, index, j)` AFTER the loop - `j` there is
   * `target.length` (one past the last valid index), not a real target index, since `j` is the
   * loop counter left over from the `for` loop rather than something explicitly reset. When
   * `brush.showText` is set, each segment gets a `round(list[j] / sum * xScale.max())` percentage
   * label via `drawText()`. */
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

  /** Returns this brush's own default options (`outerPadding`/`showText`), merged by
   * `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return FULLSTACKBAR3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('fullstackbar3d', FullStackBar3DBrush)
