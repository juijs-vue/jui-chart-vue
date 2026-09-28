// Port of legacy `src/brush/polygon/column3d.js` ("chart.brush.polygon.column3d", extend:
// "chart.brush.polygon.core") - draws each `(dataIndex, targetIndex)` cell as a real 3D `<polygon>`
// cube (`CubePolygon`, `chart.polygon.cube`, already ported to `jui-graph-ts`), one `<polygon>` SVG
// face element per visible cube face, all queued through the inherited `createPolygon()`
// (`jui-graph-ts`'s `PolygonCoreBrush` - z-sorts/rotates/stamps `.order` for `util/svg.ts`'s
// `appendAll()`).
import { registerBrush, PolygonCoreBrush, CubePolygon, colorUtil } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.polygon.column3d`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface PolygonColumn3DBrushOptions {
  /** Cube width (x-axis extent) in px; `0` auto-derives it from the x-band width minus
   * `padding` on each side. */
  width?: number
  /** Cube depth (z-axis extent) in px; `0` auto-derives it from the z-band width minus
   * `padding` on each side. */
  height?: number
  /** Gap in px reserved on each side of a cube's x/z band before auto-deriving `width`/`height`. */
  padding?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `column3d.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.polygon.column3d.setup()` fields - see legacy `polygon/column3d.js`. */
export const POLYGON_COLUMN3D_BRUSH_OWN_DEFAULTS: PolygonColumn3DBrushOptions = {
  width: 0,
  height: 0,
  padding: 20,
  clip: false,
}

export class PolygonColumn3DBrush extends PolygonCoreBrush {
  private colWidth = 0
  private colHeight = 0

  /** Builds one 3D cube for row `dataIndex`'s `target` field: a `CubePolygon` spanning
   * `[axis.y(0), axis.y(data[target])]` vertically (so the cube grows up or down from the zero
   * baseline depending on the value's sign) at `x = axis.x(dataIndex) - colWidth/2`, `z =
   * axis.z(targetIndex) - colHeight/2`, sized `colWidth` x `colHeight` in the other two dimensions.
   * The callback renders one `<polygon>` per visible cube face (`p.faces`, each a list of vertex
   * indices into `p.vectors`), filled in the target's series `color` and stroked with a
   * darkened variant of it (reusing `polygonColumnBorderOpacity` as `colorUtil.darken()`'s rate,
   * not just its own stroke opacity - matching the legacy source exactly), all grouped under one
   * `<g>`. Hover/click events are wired via `addEvent()` only when the cell's value is non-zero
   * (a zero-value column renders but isn't interactive). */
  private createColumn(data: BrushData, target: string, dataIndex: number, targetIndex: number) {
    const w = this.colWidth
    const h = this.colHeight
    const x = (this.axis.x as BrushAxisScale)(dataIndex) - w / 2
    const y = (this.axis.y as BrushAxisScale)(data[target])
    const yy = (this.axis.y as BrushAxisScale)(0)
    const z = (this.axis.z as BrushAxisScale)(targetIndex) - h / 2
    const color = this.color(targetIndex)

    // Explicit `<CubePolygon, any>` generic args - `createPolygon()`'s own `E extends
    // PolygonBrushElement` bound requires an index-signature type, which the real returned
    // `TransElement` (`this.chart.svg.group()`, not publicly exported/nameable from this package)
    // structurally isn't - `any` satisfies the bound trivially while keeping the real runtime
    // object (and its real `.order` stamp from `createPolygon()` itself) untouched.
    return this.createPolygon<CubePolygon, any>(new CubePolygon(x, yy, z, w, y - yy, h), (p) => {
      const g = this.chart.svg.group()

      for (let i = 0; i < p.faces.length; i++) {
        const key = p.faces[i]

        const face = this.chart.svg.polygon({
          fill: color,
          'fill-opacity': this.chart.theme('polygonColumnBackgroundOpacity'),
          stroke: colorUtil.darken(color as string, this.chart.theme('polygonColumnBorderOpacity') as number),
          'stroke-opacity': this.chart.theme('polygonColumnBorderOpacity'),
        })

        for (let j = 0; j < key.length; j++) {
          const vector = p.vectors![key[j]]
          face.point(vector.x, vector.y)
        }

        g.append(face)
      }

      if (data[target] != 0) {
        this.addEvent(g, dataIndex, targetIndex)
      }

      return g
    })
  }

  /** Resolves this render pass's shared cube footprint: `colWidth`/`colHeight` are `brush.width`/
   * `brush.height` verbatim when set above `0`, otherwise auto-derived from the x/z axis band
   * widths (`rangeBand()`) minus `padding` on both sides. */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const padding = brush.padding as number
    const width = (this.axis.x as BrushAxisScale).rangeBand!()
    const height = (this.axis.z as BrushAxisScale).rangeBand!()

    this.colWidth = (brush.width as number) > 0 ? (brush.width as number) : width - padding * 2
    this.colHeight = (brush.height as number) > 0 ? (brush.height as number) : height - padding * 2
  }

  /** Draws every `(row, target)` cell as a 3D cube via `createColumn()`, iterating all rows from
   * `listData()` against every configured `target` field, appending each into one shared group. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const datas = this.listData() as BrushData[]
    const targets = (this.brush as Record<string, unknown>).target as string[]

    for (let i = 0; i < datas.length; i++) {
      for (let j = 0; j < targets.length; j++) {
        g.append(this.createColumn(datas[i], targets[j], i, j))
      }
    }

    return g
  }

  /** Returns this brush's own default options (`width`/`height`/`padding`/`clip`), merged by
   * `defineOptions()` on top of `PolygonCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return POLYGON_COLUMN3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('polygon.column3d', PolygonColumn3DBrush)
