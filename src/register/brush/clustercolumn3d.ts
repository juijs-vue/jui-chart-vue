// Port of legacy `src/brush/clustercolumn3d.js` ("chart.brush.clustercolumn3d", extend:
// "chart.brush.core" - see `clusterbar3d.ts`'s identical note on its own stale "@extends
// chart.brush.bar" JSDoc comment vs. the real, authoritative `extend:` field). The vertical
// counterpart to `clusterbar3d.ts`, with its own `drawMain()` seam for `clustercylinder3d.ts`
// (`extend: "chart.brush.clustercolumn3d"`) to override.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

type CAxis = (i: unknown, v: unknown, j: unknown, count: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }

/** `chart.brush.clustercolumn3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface ClusterColumn3DBrushOptions {
  /** Padding reserved at the left/right of each row's clustered-lane group. */
  outerPadding?: number
  /** Gap in px between adjacent target lanes within the same row. */
  innerPadding?: number
}

/** Own `chart.brush.clustercolumn3d.setup()` fields - see legacy `clustercolumn3d.js`. */
export const CLUSTERCOLUMN3D_BRUSH_OWN_DEFAULTS: ClusterColumn3DBrushOptions = {
  outerPadding: 5,
  innerPadding: 5,
}

/** `chart.brush.clustercolumn3d`: the vertical counterpart to `ClusterBar3DBrush` - draws each
 * target as its own offset isometric depth "lane" within a row's vertical band, via the `"grid3d"`
 * axis's `axis.c(index, value, targetIndex, targetCount)` projection. Box construction is factored
 * into an overridable `drawMain()` seam specifically so `ClusterCylinder3DBrush` can swap in a
 * cylinder shape while reusing this class's `drawBefore()`/`draw()` layout and event logic
 * unchanged. */
export class ClusterColumn3DBrush extends CoreBrush {
  protected g: any
  private width = 0

  /** Computes this render pass's shared box width: the x-axis row band (`rangeBand()`) shrunk by
   * `outerPadding` on both left and right. Every target's lane shares this same width; only the
   * depth axis distinguishes them (via the "grid3d" axis's `axis.c(index, value, targetIndex,
   * targetCount)`). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    this.g = this.chart.svg.group()
    this.width = (this.axis.x as BrushAxisScale).rangeBand!() - (brush.outerPadding as number) * 2
  }

  /** Builds one box's 3D shape. An overridable seam so `clustercylinder3d.ts`'s
   * `ClusterCylinder3DBrush` (`extend: "chart.brush.clustercolumn3d"`) can override just this method
   * to swap in a cylinder shape while reusing every other layout/event calculation in `draw()`
   * unchanged. Here, a plain extruded box via `chart.svg.rect3d()`. */
  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.rect3d(color, width, height, degree as number, depth)
  }

  /** Draws every row's clustered 3D columns, one lane per target, via `drawMain()` (overridden by
   * `clustercylinder3d.ts` for a cylinder shape). Iterates rows in REVERSE (`eachData(..., true)`,
   * hence the swapped `(index, data)` callback argument order noted below), and always
   * `prepend()`s each box, so the net visual stacking order matches the original engine's own
   * draw order. Each box's height is the vertical span between the value's and zero's projected y
   * positions at that lane; its depth is `xy.depth - padding` (padding clamped to at most the
   * lane's own depth) and its y position is nudged up by the isometric vertical shift
   * (`sin(radian) * padding`) to keep it aligned despite that depth trim. Click/hover events are
   * skipped for exactly-zero values. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const count = target.length
    const c = this.axis.c as unknown as CAxis

    // `reverse: true` - `CoreBrush.eachData()`'s own documented "reversed (index, data) argument
    // order" quirk (see `jui-graph-ts`'s `brush/core.ts` header comment): the callback receives
    // `(index, dataRow)`, NOT the usual `(dataRow, index)`.
    this.eachData(
      (i, data) => {
        const row = data as BrushData
        const index = i as number

        for (let j = 0; j < count; j++) {
          const value = row[target[j]]
          const xy = c(index, value, j, count)
          const zeroXY = c(index, 0, j, count)
          const padding = (brush.innerPadding as number) > xy.depth ? xy.depth : (brush.innerPadding as number)

          const startX = xy.x - this.width / 2
          const startY = xy.y - Math.sin((this.axis.c as unknown as CScale).radian) * padding
          const height = Math.abs(zeroXY.y - xy.y)
          const r = this.drawMain(this.color(j), this.width, height, (this.axis.c as unknown as CScale).degree, xy.depth - padding)

          if (value != 0) {
            this.addEvent(r, index, j)
          }

          r.translate(startX, startY)

          this.g.prepend(r)
        }
      },
      true,
    )

    return this.g
  }

  /** Returns this brush's own default options (`outerPadding`/`innerPadding`), merged by
   * `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return CLUSTERCOLUMN3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('clustercolumn3d', ClusterColumn3DBrush)
