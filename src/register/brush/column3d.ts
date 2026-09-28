// Port of legacy `src/brush/column3d.js` ("chart.brush.column3d", extend: "chart.brush.core") -
// the vertical-column counterpart to `bar3d.ts`, isolating its own per-cell shape-building into a
// separate `drawMain(color, width, height, degree, depth)` method specifically so
// `cylinder3d.ts` (`extend: "chart.brush.column3d"`) can override JUST that one method and reuse
// everything else (`drawBefore()`/`draw()`) unchanged via real TS class inheritance.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

type CAxis = (i: unknown, v: unknown) => { x: number; y: number; depth: number }

/** `chart.brush.column3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface Column3DBrushOptions {
  /** Padding reserved at the left/right of each row's extruded-box group. */
  outerPadding?: number
  /** Gap in px between adjacent boxes within the same row (for multiple `target` keys). */
  innerPadding?: number
}

/** Own `chart.brush.column3d.setup()` fields - see legacy `column3d.js`. */
export const COLUMN3D_BRUSH_OWN_DEFAULTS: Column3DBrushOptions = {
  outerPadding: 10,
  innerPadding: 5,
}

export class Column3DBrush extends CoreBrush {
  protected g: any
  private width = 0
  private colWidth = 0

  /** Computes this render pass's shared geometry: `width` (the full x-axis row band from
   * `rangeBand()`) and `colWidth` (per-target box thickness, fitting every `target` key into the
   * row width minus `outerPadding` on each side and `innerPadding` gaps between them, clamped to
   * `0` rather than going negative when there isn't enough room). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]

    this.g = this.chart.svg.group()
    this.width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.colWidth = (this.width - (brush.outerPadding as number) * 2 - (target.length - 1) * (brush.innerPadding as number)) / target.length
    this.colWidth = this.colWidth < 0 ? 0 : this.colWidth
  }

  /** Builds one box's 3D shape. An overridable seam so `cylinder3d.ts`'s `Cylinder3DBrush` (`extend:
   * "chart.brush.column3d"`) can override just this method to swap in a cylinder shape while
   * reusing every other layout/event calculation in `draw()` unchanged. Here, a plain extruded box
   * via `chart.svg.rect3d()`. */
  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.rect3d(color, width, height, degree as number, depth)
  }

  /** Draws every row's extruded 3D boxes, one per target, laid out side by side within the row band
   * using `drawBefore()`'s `colWidth`, via `drawMain()`. Each box's height is the vertical span
   * between the value's and zero's projected y positions (`axis.c(index, value)`); `startY` is
   * nudged down by the isometric vertical shift (`sin(radian) * depth`) so the extrusion still
   * lines up despite the depth offset. Click/hover events are skipped for exactly-zero values, same
   * convention as `bar3d.ts`'s `draw()`. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const count = target.length
    const c = this.axis.c as unknown as CAxis

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const zeroXY = c(index, 0)
      let startX = zeroXY.x - (this.width - (brush.outerPadding as number) * 2) / 2

      for (let j = 0; j < count; j++) {
        const value = row[target[j]]
        const xy = c(index, value)

        const startY = xy.y + Math.sin((this.axis.c as unknown as { radian: number }).radian) * xy.depth
        const height = Math.abs(zeroXY.y - xy.y)
        const r = this.drawMain(this.color(j), this.colWidth, height, (this.axis.c as unknown as { degree: unknown }).degree, xy.depth)

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        r.translate(startX, startY)

        this.g.append(r)

        startX += this.colWidth + (brush.innerPadding as number)
      }
    })

    return this.g
  }

  /** Returns this brush's own default options (`outerPadding`/`innerPadding`), merged by
   * `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return COLUMN3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('column3d', Column3DBrush)
