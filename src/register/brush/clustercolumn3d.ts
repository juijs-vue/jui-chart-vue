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

export class ClusterColumn3DBrush extends CoreBrush {
  protected g: any
  private width = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    this.g = this.chart.svg.group()
    this.width = (this.axis.x as BrushAxisScale).rangeBand!() - (brush.outerPadding as number) * 2
  }

  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.rect3d(color, width, height, degree as number, depth)
  }

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

  static setup(): Record<string, unknown> {
    return CLUSTERCOLUMN3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('clustercolumn3d', ClusterColumn3DBrush)
