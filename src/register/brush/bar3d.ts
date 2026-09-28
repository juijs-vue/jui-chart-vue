// Port of legacy `src/brush/bar3d.js` ("chart.brush.bar3d", extend: "chart.brush.core") - a
// "pseudo-3D" (isometric-style) horizontal bar brush: each cell is a `chart.svg.rect3d(...)`
// extruded box (`jui-graph-ts`'s `SVG3d.rect3d()`, `util/svg/base3d.ts`), positioned via the
// `"grid3d"` `c` axis's own `axis.c(value, index)` -> `{x,y,depth}` projection (a SEPARATE, simpler
// "isometric extrusion" 3D system from the `polygon.*`-family's real rotate+perspective engine,
// despite sharing the same `"grid3d"` grid type).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

type CAxis = (v: unknown, i: unknown) => { x: number; y: number; depth: number }

/** `chart.brush.bar3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface Bar3DBrushOptions {
  /** Padding reserved at the top/bottom of each row's extruded-box group. */
  outerPadding?: number
  /** Gap in px between adjacent boxes within the same row (for multiple `target` keys). */
  innerPadding?: number
}

/** Own `chart.brush.bar3d.setup()` fields - see legacy `bar3d.js`. */
export const BAR3D_BRUSH_OWN_DEFAULTS: Bar3DBrushOptions = {
  outerPadding: 10,
  innerPadding: 5,
}

export class Bar3DBrush extends CoreBrush {
  private g: any
  private height = 0
  private colHeight = 0

  /** Computes this render pass's shared geometry: `height` (the full row band height from the
   * y-axis's `rangeBand()`) and `colHeight` (per-target box thickness, fitting every `target` key
   * into the row height minus `outerPadding` on each side and `innerPadding` gaps between them,
   * clamped to `0` rather than going negative when there isn't enough room). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]

    this.g = this.chart.svg.group()
    this.height = (this.axis.y as BrushAxisScale).rangeBand!()
    this.colHeight = (this.height - (brush.outerPadding as number) * 2 - (target.length - 1) * (brush.innerPadding as number)) / target.length
    this.colHeight = this.colHeight < 0 ? 0 : this.colHeight
  }

  /** Draws every row's extruded 3D boxes, one per target, stacked vertically within the row band
   * using `drawBefore()`'s `colHeight`. Per target: `zeroXY`/`xy` are the `"grid3d"` axis's
   * isometric projections of value `0` and the target's actual value at this row; `width` is the
   * horizontal span between them; `top` compensates the box's vertical position for the isometric
   * depth shift (`sin(radian) * depth`) so the extrusion still lines up with `startY`. Each box is
   * built via `chart.svg.rect3d()` and `prepend()`-ed (not `append()`-ed) to the group so later
   * targets' boxes layer visually in front of earlier ones, matching the isometric perspective.
   * Click/hover events are skipped for exactly-zero values, same convention as `bar.ts`'s
   * `getBarElement()`. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const count = target.length
    const c = this.axis.c as unknown as CAxis

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const zeroXY = c(0, index)
      let startY = zeroXY.y - (this.height - (brush.outerPadding as number) * 2) / 2

      for (let j = 0; j < count; j++) {
        const value = row[target[j]]
        const xy = c(value, index)
        const top = Math.sin((this.axis.c as unknown as { radian: number }).radian) * xy.depth
        const width = Math.abs(zeroXY.x - xy.x)
        const r = this.chart.svg.rect3d(this.color(j), width, this.colHeight, (this.axis.c as unknown as { degree: number }).degree, xy.depth)

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        r.translate(zeroXY.x, startY + top)

        this.g.prepend(r)

        startY += this.colHeight + (brush.innerPadding as number)
      }
    })

    return this.g
  }

  /** Returns this brush's own default options (`outerPadding`/`innerPadding`), merged by
   * `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return BAR3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('bar3d', Bar3DBrush)
