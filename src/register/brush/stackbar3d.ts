// Port of legacy `src/brush/stackbar3d.js` ("chart.brush.stackbar3d", extend: "chart.brush.core")
// - stacks every target's own extruded box end-to-end along x, all sharing one row-height "lane".
//
// **PRESERVED BUG, genuine and reachable**: legacy `draw()`'s trailing `if(value != 0) {
// this.addEvent(group, i, j); }` (AFTER the `for(j...)` loop) reads `value`/`j` - both `for`-loop-
// scoped `var`s from the LAST loop iteration (JS function-scoped `var` hoisting keeps them alive
// after the loop exits), i.e. this re-fires `addEvent` a SECOND time on the (empty, never-appended-
// to-`g`) `group` variable using only the FINAL target's own `value`/`j` - `group` itself is built
// but never actually used for anything else (each `r` is appended straight to `g`, not `group`).
// Ported literally: `group` stays genuinely unused garbage, and the trailing `addEvent` call fires
// on it with the closure's final-iteration `value`/`j`, exactly matching the original.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type CAxis = (v: unknown, i: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }

/** `chart.brush.stackbar3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface StackBar3DBrushOptions {
  /** Padding reserved at the top/bottom of each row's stacked-box lane. */
  outerPadding?: number
}

/** Own `chart.brush.stackbar3d.setup()` fields - see legacy `stackbar3d.js`. */
export const STACKBAR3D_BRUSH_OWN_DEFAULTS: StackBar3DBrushOptions = {
  outerPadding: 10,
}

export class StackBar3DBrush extends CoreBrush {
  private g: any
  private barHeight = 0
  private zeroXY = { x: 0, y: 0, depth: 0 }

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. Caches
   * the shared lane height (`barHeight`, the row band minus twice `outerPadding`) and the
   * panel-grid origin (`zeroXY`, `axis.c(0, 0)`) every row's boxes are offset from. */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const height = (this.axis.y as unknown as { rangeBand(): number }).rangeBand()

    this.g = this.chart.svg.group()
    this.barHeight = height - (brush.outerPadding as number) * 2
    this.zeroXY = (this.axis.c as unknown as CAxis)(0, 0)
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. For each row,
   * draws every target's extruded 3D box (`rect3d()`) end-to-end along x within one shared
   * `barHeight` lane, each offset further right by the running `colWidth` and vertically by its
   * own depth-driven `top` (from `axis.c`'s own `radian`/`degree` projection). See this file's
   * header comment for the preserved trailing `addEvent(group, ...)` bug (an unused, never-
   * appended `group` element gets a spurious second event binding using the last target's stale
   * `value`/`j`). */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const c = this.axis.c as unknown as CAxis

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const group = this.chart.svg.group()
      let startY = c(0, index).y - this.barHeight / 2
      let colWidth = 0
      let value: unknown
      let j = 0

      for (j = 0; j < target.length; j++) {
        value = row[target[j]]
        const xy = c(value, index)
        const top = Math.sin((this.axis.c as unknown as CScale).radian) * xy.depth
        const width = Math.abs(this.zeroXY.x - xy.x)
        const r = this.chart.svg.rect3d(this.color(j), width, this.barHeight, (this.axis.c as unknown as CScale).degree as number, xy.depth)

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        r.translate(this.zeroXY.x + colWidth, startY + top)

        this.g.append(r)

        colWidth += width
      }

      // See header comment - preserved verbatim, including `group` staying unused garbage.
      if (value != 0) {
        this.addEvent(group, index, j)
      }

      this.g.append(group)
    })

    return this.g
  }

  /** Returns this brush's own config defaults (`STACKBAR3D_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return STACKBAR3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('stackbar3d', StackBar3DBrush)
