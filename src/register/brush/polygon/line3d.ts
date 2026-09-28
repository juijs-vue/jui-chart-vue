// Port of legacy `src/brush/polygon/line3d.js` ("chart.brush.polygon.line3d", extend:
// "chart.brush.polygon.core") - draws each `(dataIndex -> dataIndex+1, targetIndex)` ribbon
// segment as a single 4-point `<polygon>` face, built from FOUR SEPARATE single-vertex
// `PointPolygon`s (NOT a `LinePolygon`, despite the file's own name - see `jui-graph-ts`'s
// `polygon/line.ts` header comment, which confirms this exact real-source quirk), each rotated
// individually via the inherited `createPolygon()`'s own per-call `this.calculate3d(polygon)` - so
// the four corners of one ribbon quad can each end up with slightly different projected
// perspective/rotation before being assembled into one `<polygon>` element by hand.
import { registerBrush, PolygonCoreBrush, PointPolygon, colorUtil } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.polygon.line3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface PolygonLine3DBrushOptions {
  /** Gap in px reserved on each side of a ribbon segment's z-band, shrinking the ribbon's own
   * z-axis thickness. */
  padding?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `line3d.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.polygon.line3d.setup()` fields - see legacy `polygon/line3d.js`. */
export const POLYGON_LINE3D_BRUSH_OWN_DEFAULTS: PolygonLine3DBrushOptions = {
  padding: 10,
  clip: false,
}

export class PolygonLine3DBrush extends PolygonCoreBrush {
  /** Builds one ribbon-segment `<polygon>` connecting row `dataIndex` to row `dataIndex + 1` for
   * `target`, at `targetIndex`'s z-band (thickness `d = axis.z.rangeBand() - padding * 2`,
   * centered on that band). Computes the 4 quad corners - near/far-z at the start point, far/near-z
   * at the end point (so the two z-sides connect straight across rather than crossing) - and runs
   * EACH corner through its own `createPolygon(PointPolygon, ...)` call (per this file's own header
   * comment: real per-vertex rotation, not a single shared transform), manually appending each
   * projected `(x, y)` onto the pre-built `elem` polygon via `.point()` since these per-vertex
   * callbacks return `undefined` rather than an element (so `createPolygon()`'s own automatic
   * `.order` stamping never runs for them). Tracks whichever corner has the largest projected `z`
   * (`maxPoint`) and, after all 4 are added, manually stamps `elem.order = axis.depth -
   * maxPoint.max().z` - a hand-rolled z-sort value based on that farthest corner, done here because
   * the automatic stamping path was bypassed. Filled in the series `color`, stroked with a darkened
   * variant reusing `polygonLineBorderOpacity` as the darken rate (matching the legacy source, same
   * as `column3d.ts`'s identical pattern). */
  private createLine(datas: BrushData[], target: string, dataIndex: number, targetIndex: number) {
    const brush = this.brush as Record<string, unknown>
    const color = this.color(dataIndex, targetIndex)
    const d = (this.axis.z as BrushAxisScale).rangeBand!() - (brush.padding as number) * 2
    const x1 = (this.axis.x as BrushAxisScale)(dataIndex)
    const y1 = (this.axis.y as BrushAxisScale)(datas[dataIndex][target])
    const z1 = (this.axis.z as BrushAxisScale)(targetIndex) - d / 2
    const x2 = (this.axis.x as BrushAxisScale)(dataIndex + 1)
    const y2 = (this.axis.y as BrushAxisScale)(datas[dataIndex + 1][target])
    const z2 = (this.axis.z as BrushAxisScale)(targetIndex) + d / 2
    let maxPoint: PointPolygon | null = null

    const elem = this.chart.svg.polygon({
      fill: color,
      'fill-opacity': this.chart.theme('polygonLineBackgroundOpacity'),
      stroke: colorUtil.darken(color as string, this.chart.theme('polygonLineBorderOpacity') as number),
      'stroke-opacity': this.chart.theme('polygonLineBorderOpacity'),
    })

    const points = [new PointPolygon(x1, y1, z1), new PointPolygon(x1, y1, z2), new PointPolygon(x2, y2, z2), new PointPolygon(x2, y2, z1)]

    for (let i = 0; i < points.length; i++) {
      // Explicit `<PointPolygon, any>` generic args - see `column3d.ts`'s identical note. Each
      // per-vertex callback here never returns anything (`undefined`), matching the legacy
      // source's own real usage (see this file's header comment).
      this.createPolygon<PointPolygon, any>(points[i], (p) => {
        const vector = p.vectors![0]
        elem.point(vector.x, vector.y)

        if (maxPoint == null) {
          maxPoint = p
        } else if (vector.z > maxPoint.vectors![0].z) {
          maxPoint = p
        }

        return undefined
      })
    }

    // 별도로 우선순위 설정 (a separate, manual priority/order stamp - see this file's own header
    // comment: `createPolygon()`'s own `element.order` stamp never fires here, since each
    // per-vertex callback above returns `undefined`). `.order` isn't part of `PolyElement`'s own
    // declared shape (it's a z-sort field `util/svg.ts`'s `appendAll()` merely reads off
    // whatever's there), same reason `createPolygon()`'s own `element.order = ...` stamp needs a
    // structural cast internally - cast here too, for the identical reason.
    ;(elem as unknown as { order?: number }).order = (this.axis.depth as number) - (maxPoint as unknown as PointPolygon).max().z

    return elem
  }

  /** Draws every consecutive-row ribbon segment (`i` to `i + 1`, hence looping only to
   * `datas.length - 1`) for every configured `target`, via `createLine()`, appending each into one
   * shared group. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const datas = this.listData() as BrushData[]
    const targets = (this.brush as Record<string, unknown>).target as string[]

    for (let i = 0; i < datas.length - 1; i++) {
      for (let j = 0; j < targets.length; j++) {
        g.append(this.createLine(datas, targets[j], i, j))
      }
    }

    return g
  }

  /** Returns this brush's own default options (`padding`/`clip`), merged by `defineOptions()` on
   * top of `PolygonCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return POLYGON_LINE3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('polygon.line3d', PolygonLine3DBrush)
