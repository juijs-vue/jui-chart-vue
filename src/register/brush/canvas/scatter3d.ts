// Port of legacy `src/brush/canvas/scatter3d.js` ("chart.brush.canvas.scatter3d", extend:
// "chart.brush.canvas.core") - a 3D canvas scatter brush: each `(dataIndex, targetIndex)` cell is
// a single perspective-scaled, radial-gradient-filled circle, positioned via a single-vertex
// `PointPolygon` (same primitive `dot3d.ts`'s dot mode / `line3d.ts`'s ribbon corners / this
// project's own SVG `polygon.scatter3d` already use) and the inherited `addPolygon()`
// (`CanvasCoreBrush` - rotates/z-sorts/drains via `drawAfter()`).
import { registerBrush, CanvasCoreBrush, PointPolygon, colorUtil, mathUtil } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.canvas.scatter3d`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface CanvasScatter3DBrushOptions {
  /** Marker diameter in px before perspective scaling. */
  size?: number
}

/** Own `chart.brush.canvas.scatter3d.setup()` fields - see legacy `canvas/scatter3d.js`. */
export const CANVAS_SCATTER3D_BRUSH_OWN_DEFAULTS: CanvasScatter3DBrushOptions = {
  size: 7,
}

/** A 3D canvas scatter brush: each `(dataIndex, targetIndex)` cell is a single perspective-scaled,
 * radial-gradient-filled circle, positioned via a single-vertex `PointPolygon` (`x`/`z` keyed by the
 * row index itself, `y` from the data value) and the inherited `addPolygon()`
 * (`CanvasCoreBrush` - rotates/z-sorts/drains via `drawAfter()`), giving each dot a soft 3D-sphere
 * look. */
export class CanvasScatter3DBrush extends CanvasCoreBrush {
  /** Draws one 3D marker for row `dataIndex`'s `target` field. Both `x` and `z` are derived from
   * `dataIndex` itself (`axis.x(dataIndex)`/`axis.z(dataIndex)`, not any data field - every point
   * in a series sits at its own row position along both the x and depth axes), while `y` comes from
   * the actual `data[target]` value. Queues a single-vertex `PointPolygon` so the engine's
   * perspective/z-sort pass runs on it; the callback scales the base radius `r` by
   * `mathUtil.scaleValue(z, 0, axis.depth, 1, p.perspective)` (shrinking distant points) and fills
   * a radial gradient from the series `color` at the center out to a lightened variant
   * (`colorUtil.lighten(color, theme('polygonScatterRadialOpacity'))`) at the edge, giving each dot
   * a soft 3D-sphere look. */
  private createScatter(data: BrushData, target: string, dataIndex: number, targetIndex: number): void {
    const color = this.color(dataIndex, targetIndex)
    const r = ((this.brush as Record<string, unknown>).size as number) / 2
    const x = (this.axis.x as BrushAxisScale)(dataIndex)
    const y = (this.axis.y as BrushAxisScale)(data[target])
    const z = (this.axis.z as BrushAxisScale)(dataIndex)

    this.addPolygon(new PointPolygon(x, y, z), (p) => {
      const tx = p.vectors![0].x
      const ty = p.vectors![0].y
      const tr = r * mathUtil.scaleValue(z, 0, this.axis.depth as number, 1, p.perspective as number)
      const tc = colorUtil.lighten(color, this.chart.theme('polygonScatterRadialOpacity') as number)

      const canvas = this.canvas as CanvasRenderingContext2D
      const grd = canvas.createRadialGradient(tx, ty, tr / 2, tx, ty, tr)
      grd.addColorStop(0, color)
      grd.addColorStop(1, tc)

      canvas.beginPath()
      canvas.arc(tx, ty, tr, 0, 2 * Math.PI, false)
      canvas.fillStyle = grd
      canvas.fill()
    })
  }

  /** Draws every `(row, target)` cell as a 3D marker via `createScatter()`, iterating all rows
   * from `listData()` against every configured `target` field. */
  draw = (): void => {
    const datas = this.listData() as BrushData[]
    const targets = (this.brush as Record<string, unknown>).target as string[]

    for (let i = 0; i < datas.length; i++) {
      for (let j = 0; j < targets.length; j++) {
        this.createScatter(datas[i], targets[j], i, j)
      }
    }
  }

  /** Returns this brush's own default options (`size`), merged by `defineOptions()` on top of
   * `CanvasCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return CANVAS_SCATTER3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.scatter3d', CanvasScatter3DBrush)
