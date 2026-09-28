// Port of legacy `src/brush/stackcolumn3d.js` ("chart.brush.stackcolumn3d", extend:
// "chart.brush.core") - the vertical counterpart to `stackbar3d.ts`, with its own `drawMain()`
// seam for `stackcylinder3d.ts` (`extend: "chart.brush.stackcolumn3d"`) to override. Unlike
// `stackbar3d.ts`, this one's `group` IS actually used (`group.append(r)`, not `g.append(r)`
// directly) - no equivalent "unused group" bug here.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

type CAxis = (i: unknown, v: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }

/** `chart.brush.stackcolumn3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface StackColumn3DBrushOptions {
  /** Padding reserved at the left/right of each row's stacked-box lane. */
  outerPadding?: number
}

/** Own `chart.brush.stackcolumn3d.setup()` fields - see legacy `stackcolumn3d.js`. */
export const STACKCOLUMN3D_BRUSH_OWN_DEFAULTS: StackColumn3DBrushOptions = {
  outerPadding: 10,
}

export class StackColumn3DBrush extends CoreBrush {
  protected g: any
  private barWidth = 0
  private zeroXY = { x: 0, y: 0, depth: 0 }

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. Caches
   * the shared lane width (`barWidth`, the column band minus twice `outerPadding`) and the
   * panel-grid origin (`zeroXY`, `axis.c(0, 0)`) every column's boxes are offset from. */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const width = (this.axis.x as BrushAxisScale).rangeBand!()

    this.g = this.chart.svg.group()
    this.barWidth = width - (brush.outerPadding as number) * 2
    this.zeroXY = (this.axis.c as unknown as CAxis)(0, 0)
  }

  /** Builds one stacked segment's extruded 3D box. Factored out as its own overridable method
   * (unlike `stackbar3d.ts`'s inline `rect3d()` call) purely so `stackcylinder3d.ts`'s
   * `StackCylinder3DBrush` can override just this piece and reuse this class's `drawBefore`/`draw`
   * wholesale. */
  drawMain(index: number, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.rect3d(this.color(index), width, height, degree as number, depth)
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. For each row,
   * stacks every target's box upward along y within one shared `barWidth` lane, each segment's
   * box built via the overridable `drawMain()` and offset further up by the running `colHeight`
   * plus its own depth-driven `top` projection. Unlike `stackbar3d.ts`, `group` here is genuinely
   * used (each `r` appends to it, not directly to `this.g`) - no equivalent unused-`group` bug. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const c = this.axis.c as unknown as CAxis

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const group = this.chart.svg.group()
      const startX = c(index, 0).x - this.barWidth / 2
      let colHeight = 0

      for (let j = 0; j < target.length; j++) {
        const value = row[target[j]]
        const xy = c(index, value)
        const top = Math.sin((this.axis.c as unknown as CScale).radian) * xy.depth

        const startY = xy.y + top
        const height = Math.abs(this.zeroXY.y - xy.y)
        const r = this.drawMain(j, this.barWidth, height, (this.axis.c as unknown as CScale).degree, xy.depth)

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        r.translate(startX, startY - colHeight)
        group.append(r)

        colHeight += height
      }

      this.g.append(group)
    })

    return this.g
  }

  /** Returns this brush's own config defaults (`STACKCOLUMN3D_BRUSH_OWN_DEFAULTS`) for
   * `builder.ts`'s `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return STACKCOLUMN3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('stackcolumn3d', StackColumn3DBrush)
