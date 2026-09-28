// Port of legacy `src/brush/canvas/dot3d.js` ("chart.brush.canvas.dot3d", extend:
// "chart.brush.canvas.core") - the "first canvas brush that actually EXERCISES
// `chart.brush.canvas.core`'s `addPolygon()`/`drawAfter()`" (per `jui-graph-ts`'s own
// `brush/canvas/core.ts` header comment) - draws 3D dot/line/poly/area series directly onto the
// canvas 2D context, each shape queued via `this.addPolygon(polygon, callback)` for deferred,
// z-sorted drawing.
//
// **Local `FacePolygon`** (`chart.polygon.face`, `jui.define(..., "chart.polygon.core")`): a
// single-quad-face 3D primitive private to this one legacy file (never exported/registered by
// `juijs-graph`/`jui-graph-ts` itself - NOT the same as the ALREADY-PORTED `GridPolygon`, a
// different quad primitive for the 3D grid mesh). Ported here as a small local class extending
// `jui-graph-ts`'s real `PolygonCore` (`chart.polygon.core`), matching `polygon/grid.ts`'s own
// "four homogeneous `Float32Array([x,y,z,1])` vertices + `vectors = []`" shape 1:1 against the
// legacy constructor.
//
// **`listData()` returns array-shaped rows here, not the usual object-shaped `BrushData` rows**:
// legacy `draw()`'s own `data.length == 2` / `data.push(0)` / `data[0]`/`data[1]`/`data[2]`
// indexing only makes sense if each `axis.data` row is itself a plain `[x, y, (z)]` array (a
// genuinely different data shape than every other brush this project has ported, which all read
// named object fields) - preserved exactly, not "fixed" to expect objects.
import { registerBrush, CanvasCoreBrush, PolygonCore, PointPolygon, LinePolygon, mathUtil } from 'jui-graph-ts'
import type { PolygonVertex } from 'jui-graph-ts'

class FacePolygon extends PolygonCore {
  constructor(x1: number, y1: number, d1: number, x2: number, y2: number, d2: number, oy: number) {
    super()
    this.vertices = [
      new Float32Array([x1, y1, d1, 1]) as PolygonVertex,
      new Float32Array([x2, y2, d2, 1]) as PolygonVertex,
      new Float32Array([x2, oy, d2, 1]) as PolygonVertex,
      new Float32Array([x1, oy, d2, 1]) as PolygonVertex,
    ]
    this.vectors = []
  }
}

/** `chart.brush.canvas.dot3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface CanvasDot3DBrushOptions {
  /** Dot diameter in px (`'dot'`), or stroke width in px (`'line'`/`'poly'`); unused for
   * `'area'` (see `createArea()`'s own always-dead `r` parameter). */
  size?: number
  /** Color index (passed to `CoreBrush.color()`) shared by every point/segment/face this brush
   * draws - NOT a per-row/per-series index like most 2D brushes' own `index`. */
  color?: number
  /** Rendering mode: `'dot'` draws one point per row; `'line'` connects consecutive rows;
   * `'poly'` is `'line'` plus closing and filling the traced outline; `'area'` fills a quad face
   * from each row down to the y=0 plane. */
  symbol?: 'dot' | 'line' | 'area' | 'poly'
}

/** Own `chart.brush.canvas.dot3d.setup()` fields - see legacy `dot3d.js`. */
export const CANVAS_DOT3D_BRUSH_OWN_DEFAULTS: CanvasDot3DBrushOptions = {
  size: 4,
  color: 0,
  symbol: 'dot',
}

type Scale3 = (value: unknown) => number

export class CanvasDot3DBrush extends CanvasCoreBrush {
  private firstCacheData: [string, number, number, number, number, number, boolean] | null = null

  /** Queues one `PointPolygon` (built from `data`'s `[x, y, z]` mapped through the 3D axis
   * scales) for deferred z-sorted rendering. The callback receives the polygon engine's already
   *-projected 2D screen point (`p.vectors[0]`) plus its per-vertex `perspective` factor, and scales
   * the base radius `r` by that factor via `mathUtil.scaleValue(z, 0, axis.depth, 1, p.perspective)`
   * so dots further along the z axis are drawn smaller, before delegating to `drawDot()`. */
  private createDot(color: string, r: number, data: number[]): void {
    const x = (this.axis.x as Scale3)(data[0])
    const y = (this.axis.y as Scale3)(data[1])
    const z = (this.axis.z as Scale3)(data[2])

    this.addPolygon(new PointPolygon(x, y, z), (p) => {
      const tx = p.vectors![0].x
      const ty = p.vectors![0].y
      const tr = r * mathUtil.scaleValue(z, 0, this.axis.depth as number, 1, p.perspective as number)

      this.drawDot(color, tx, ty, tr)
    })
  }

  /** Queues one `LinePolygon` segment from `pdata` (the previous row, or `data` itself when
   * `pdata` is `null` - i.e. the first row draws a zero-length "segment" at its own point) to
   * `data`, both mapped through the 3D axis scales. The callback receives the two already-projected
   * 2D screen endpoints and delegates to `drawLine()` with the segment's color/width and the
   * caller-supplied `isLast` flag (see this file's header comment for the `data`/`datas`
   * transcription bug behind how `draw()` computes that flag). */
  private createLine(color: string, r: number, data: number[], pdata: number[] | null, isLast: boolean): void {
    const x = (this.axis.x as Scale3)(data[0])
    const y = (this.axis.y as Scale3)(data[1])
    const z = (this.axis.z as Scale3)(data[2])
    const px = (this.axis.x as Scale3)(pdata == null ? data[0] : pdata[0])
    const py = (this.axis.y as Scale3)(pdata == null ? data[1] : pdata[1])
    const pz = (this.axis.z as Scale3)(pdata == null ? data[2] : pdata[2])

    this.addPolygon(new LinePolygon(px, py, pz, x, y, z), (p) => {
      const x1 = p.vectors![0].x
      const y1 = p.vectors![0].y
      const x2 = p.vectors![1].x
      const y2 = p.vectors![1].y

      this.drawLine(color, x1, y1, x2, y2, r, isLast)
    })
  }

  /** Queues one `FacePolygon` quad face - spanning from the previous point `pdata` (or `data`
   * itself when `pdata` is `null`) down to `data`, and from there down to the y=0 "floor" plane
   * (`oy`) - for deferred z-sorted rendering. The callback receives the four already-projected 2D
   * screen corners and delegates to `drawArea()`.
   *
   * `_r` (unused): legacy `createArea(color, r, data, pdata)` never actually reads its own `r`
   * parameter either (confirmed by reading the real source in full) - a genuinely dead parameter
   * in the original, kept in the signature here for call-site fidelity with `draw()`'s uniform
   * `create*(color, r, data, pdata, ...)` call shape, prefixed `_` to silence the (correct)
   * unused-parameter check rather than dropped. */
  private createArea(color: string, _r: number, data: number[], pdata: number[] | null): void {
    const oy = (this.axis.y as Scale3)(0)
    const x = (this.axis.x as Scale3)(data[0])
    const y = (this.axis.y as Scale3)(data[1])
    const z = (this.axis.z as Scale3)(data[2])
    const px = (this.axis.x as Scale3)(pdata == null ? data[0] : pdata[0])
    const py = (this.axis.y as Scale3)(pdata == null ? data[1] : pdata[1])
    const pz = (this.axis.z as Scale3)(pdata == null ? data[2] : pdata[2])

    this.addPolygon(new FacePolygon(px, py, pz, x, y, z, oy), (p) => {
      const x1 = p.vectors![0].x
      const y1 = p.vectors![0].y
      const x2 = p.vectors![1].x
      const y2 = p.vectors![1].y
      const x3 = p.vectors![2].x
      const y3 = p.vectors![2].y
      const x4 = p.vectors![3].x
      const y4 = p.vectors![3].y

      this.drawArea(color, x1, y1, x2, y2, x3, y3, x4, y4)
    })
  }

  /** Paints a filled circle of radius `tr` at the already-projected screen point `(tx, ty)`. */
  private drawDot(color: string, tx: number, ty: number, tr: number): void {
    const canvas = this.canvas as CanvasRenderingContext2D
    canvas.beginPath()
    canvas.arc(tx, ty, tr, 0, 2 * Math.PI, false)
    canvas.fillStyle = color
    canvas.fill()
  }

  /** Strokes one line segment from `(x1, y1)` to `(x2, y2)`. When `symbol == 'poly'`, the very
   * first segment drawn (`firstCacheData == null`) has its start point cached; once `isLast` fires
   * (per `draw()`'s buggy flag - see this file's header comment), an extra closing segment back to
   * that cached start point is drawn and the whole accumulated path is filled in `color`, turning
   * the chain of strokes into a closed, filled polygon outline. */
  private drawLine(color: string, x1: number, y1: number, x2: number, y2: number, width: number, isLast: boolean): void {
    const canvas = this.canvas as CanvasRenderingContext2D
    const isFill = (this.brush as Record<string, unknown>).symbol == 'poly'

    if (isFill && this.firstCacheData == null) {
      this.firstCacheData = [color, x1, y1, x2, y2, width, isLast]
    }

    canvas.beginPath()
    canvas.moveTo(x1, y1)
    canvas.lineTo(x2, y2)
    canvas.lineWidth = width
    canvas.strokeStyle = color
    canvas.stroke()

    if (isLast) {
      if (isFill && this.firstCacheData != null) {
        canvas.lineTo(this.firstCacheData[1], this.firstCacheData[2])
        canvas.fillStyle = this.firstCacheData[0]
        canvas.fill()
      }

      canvas.closePath()
    }
  }

  /** Strokes and fills the closed quad `(x1,y1) -> (x2,y2) -> (x3,y3) -> (x4,y4) -> (x1,y1)` in a
   * single `color` for both stroke and fill. */
  private drawArea(color: string, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void {
    const canvas = this.canvas as CanvasRenderingContext2D
    canvas.beginPath()
    canvas.moveTo(x1, y1)
    canvas.lineTo(x2, y2)
    canvas.lineTo(x3, y3)
    canvas.lineTo(x4, y4)
    canvas.lineTo(x1, y1)
    canvas.strokeStyle = color
    canvas.stroke()
    canvas.fillStyle = color
    canvas.fill()
    canvas.closePath()
  }

  /** Iterates every row from `listData()` (array-shaped `[x, y, (z)]` rows - see this file's
   * header comment) - z-padding any 2-element row with a trailing `0` in place - and, per `symbol`,
   * dispatches to `createLine()`/`createArea()`/`createDot()` with the previous row (`i == 0 ?
   * null : datas[i - 1]`) as context for line/area segments. For `'line'`/`'poly'` it also computes
   * `isLast` as `i == data.length - 1` (the CURRENT ROW's own length, always `3` after z-padding,
   * not the actual final-row index - see the header's PRESERVED BUG note), which `drawLine()` uses
   * to decide when to close and fill a `'poly'` shape. */
  draw = (): void => {
    const brush = this.brush as Record<string, unknown>
    const symbol = brush.symbol as string
    const color = this.color(brush.color as number)
    const r = (brush.size as number) / 2
    const datas = this.listData() as unknown as number[][]

    for (let i = 0; i < datas.length; i++) {
      const data = datas[i]

      if (data.length == 2) {
        data.push(0)
      }

      if (symbol == 'line' || symbol == 'poly') {
        // **PRESERVED BUG**: legacy `(i == data.length-1)` reads the CURRENT ROW's own length
        // (2 or 3, after the `data.push(0)` z-padding above always makes it 3) as the "is this the
        // last row" check, not `datas.length-1` (the actual last-row index) - so `isLast` is true
        // only when the loop index happens to equal 3 (a transcription typo: `data` vs `datas`),
        // not on the real final iteration. Kept exactly as written, not "fixed" to `datas.length -
        // 1`.
        this.createLine(color, r, data, i == 0 ? null : datas[i - 1], i == data.length - 1)
      } else if (symbol == 'area') {
        this.createArea(color, r, data, i == 0 ? null : datas[i - 1])
      } else {
        this.createDot(color, r, data)
      }
    }
  }

  /** Returns this brush's own default options (`size`/`color`/`symbol`), merged by
   * `defineOptions()` on top of `CanvasCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return CANVAS_DOT3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.dot3d', CanvasDot3DBrush)
