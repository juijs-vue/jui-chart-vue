// Port of legacy `src/brush/clusterbar3d.js` ("chart.brush.clusterbar3d", extend:
// "chart.brush.core" - the file's own JSDoc comment claims "@extends chart.brush.bar", but the
// real `extend:` field at the bottom says "chart.brush.core"; the field is authoritative, the
// comment is stale). Draws each target as its own offset "lane" within the row's band (via the
// `"grid3d"` axis's 4-arg `axis.c(value, index, targetIndex, targetCount)` call), back-to-front
// (`for ... i-- `/`j--`, so later-drawn = later-appended = visually in front, matching the
// original's own draw order exactly).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type CAxis = (v: unknown, i: unknown, j: unknown, count: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }

/** `chart.brush.clusterbar3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface ClusterBar3DBrushOptions {
  /** Padding reserved at the top/bottom of each row's clustered-lane group. */
  outerPadding?: number
  /** Gap in px between adjacent target lanes within the same row. */
  innerPadding?: number
}

/** Own `chart.brush.clusterbar3d.setup()` fields - see legacy `clusterbar3d.js`. */
export const CLUSTERBAR3D_BRUSH_OWN_DEFAULTS: ClusterBar3DBrushOptions = {
  outerPadding: 5,
  innerPadding: 5,
}

export class ClusterBar3DBrush extends CoreBrush {
  private g: any
  private height = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    this.g = this.chart.svg.group()
    this.height = (this.axis.y as unknown as { rangeBand(): number }).rangeBand() - (brush.outerPadding as number) * 2
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const count = target.length
    const dataList = this.listData() as BrushData[]
    const c = this.axis.c as unknown as CAxis

    for (let i = dataList.length - 1; i >= 0; i--) {
      const data = dataList[i]

      for (let j = count - 1; j >= 0; j--) {
        const value = data[target[j]]
        const xy = c(value, i, j, count)
        const zeroXY = c(0, i, j, count)
        const padding = (brush.innerPadding as number) > xy.depth ? xy.depth : (brush.innerPadding as number)

        const startY = xy.y - this.height / 2 + padding / 2
        const width = Math.abs(zeroXY.x - xy.x)
        const r = this.chart.svg.rect3d(this.color(j), width, this.height, (this.axis.c as unknown as CScale).degree as number, xy.depth - padding)

        if (value != 0) {
          this.addEvent(r, i, j)
        }

        r.translate(zeroXY.x, startY)

        this.g.append(r)
      }
    }

    return this.g
  }

  static setup(): Record<string, unknown> {
    return CLUSTERBAR3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('clusterbar3d', ClusterBar3DBrush)
