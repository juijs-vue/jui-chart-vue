// Port of legacy `src/brush/polygon/scatter3d.js` ("chart.brush.polygon.scatter3d", extend:
// "chart.brush.polygon.core") - draws each `(dataIndex, targetIndex)` cell as a single 3D
// `<circle>` (radial-gradient filled, perspective-scaled by depth), positioned via a single-vertex
// `PointPolygon` (`chart.polygon.point`, same primitive `dot3d.ts`'s own dot mode and `line3d.ts`'s
// four-corner ribbon quads already use) and the inherited `createPolygon()` (`jui-graph-ts`'s
// `PolygonCoreBrush` - rotates/z-sorts/stamps `.order` for `util/svg.ts`'s `appendAll()`).
//
// **Source provenance**: this file has NO counterpart anywhere in this repo's copied legacy
// `jui-chart` source tree (`find src -iname "scatter3d*"` only ever found `polygon/column3d.js`/
// `canvas/dot3d.js` - never a `polygon/scatter3d.js`), even though `chart.brush.polygon.scatter3d`
// IS real, live code in the actual bundled site engine (`www.jui-vue.io/lib/jui/js/chart.min.js`,
// confirmed via `grep -o "chart\\.brush\\.polygon\\.[a-z0-9]*"`) and IS used by a real site demo
// (`play/chart/json/full3d_scatter.js`/`realtime3.js`) that was, until this port, genuinely broken
// (0 rendered `<polygon>`/`<circle>` elements, confirmed via Playwright). The `juijs/jui-chart`
// GitHub repo's own `master`/`legacy` branches likewise only carry `column3d.js`/`line3d.js` under
// `src/brush/polygon/` - a real, confirmed gap in every copy of the source tree this project has
// access to, not something this project ever deliberately left out. The one place a byte-identical
// copy of the real `scatter3d.js` source does still exist is `juijs/store.jui.io`'s own bundled
// asset mirror (`public/jui-all/jui-chart/js/brush/polygon/scatter3d.js`, cross-checked against an
// independent second copy at `dmal4444/selfstudy`'s own vendored asset tree - both byte-identical)
// - copied verbatim into this repo's own `src/brush/polygon/scatter3d.js` (alongside every other
// pre-copied legacy source file) before this port, per this project's normal workflow.
import { registerBrush, PolygonCoreBrush, PointPolygon, colorUtil, mathUtil } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.polygon.scatter3d`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface PolygonScatter3DBrushOptions {
  /** Marker diameter in px before perspective scaling. */
  size?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `scatter3d.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.polygon.scatter3d.setup()` fields - see legacy `polygon/scatter3d.js`. */
export const POLYGON_SCATTER3D_BRUSH_OWN_DEFAULTS: PolygonScatter3DBrushOptions = {
  size: 7,
  clip: false,
}

/** Draws each `(dataIndex, targetIndex)` cell as a single 3D `<circle>` (radial-gradient filled,
 * perspective-scaled by depth), positioned via a single-vertex `PointPolygon` and the inherited
 * `createPolygon()` (`PolygonCoreBrush` - rotates/z-sorts/stamps `.order` for `appendAll()`). Per
 * this file's header comment, this class has no counterpart in this repo's copied legacy source tree
 * despite being real, live code in the actual bundled site engine - ported from an external mirror
 * of the original `polygon/scatter3d.js`. */
export class PolygonScatter3DBrush extends PolygonCoreBrush {
  /** Builds one 3D marker `<circle>` for row `dataIndex`'s `target` field, at `(axis.x(dataIndex),
   * axis.y(data[target]), axis.z(dataIndex))` - both `x` and `z` keyed by the row index itself, not
   * a data field (same shape as `canvas/scatter3d.ts`'s identical convention). Unless `this.color()`
   * already returned a gradient reference (`color.indexOf('radial') != -1`), wraps the flat series
   * color into a synthetic radial gradient (`'radial(40%,40%,100%,0%,0%)'`, lightened center via
   * `polygonScatterRadialOpacity` fading to the plain color at `70%`) so every marker gets a
   * soft-sphere look. The `createPolygon()` callback scales the circle's radius by
   * `mathUtil.scaleValue(z, 0, axis.depth, 1, p.perspective)` (shrinking distant markers) and wires
   * hover/click events via `addEvent()` only when the cell's value is non-zero. */
  private createScatter(data: BrushData, target: string, dataIndex: number, targetIndex: number) {
    let color = this.color(dataIndex, targetIndex)
    const r = ((this.brush as Record<string, unknown>).size as number) / 2
    const x = (this.axis.x as BrushAxisScale)(dataIndex)
    const y = (this.axis.y as BrushAxisScale)(data[target])
    const z = (this.axis.z as BrushAxisScale)(dataIndex)

    if (color.indexOf('radial') == -1) {
      color = this.chart.color(
        'radial(40%,40%,100%,0%,0%) 0% ' + colorUtil.lighten(color, this.chart.theme('polygonScatterRadialOpacity') as number) + ',70% ' + color,
      )
    }

    // Explicit `<PointPolygon, any>` generic args - see `column3d.ts`'s/`line3d.ts`'s identical
    // note: `createPolygon()`'s own `E extends PolygonBrushElement` bound requires an
    // index-signature type, which the real returned `<circle>` element (`this.chart.svg.circle()`,
    // not publicly exported/nameable from this package) structurally isn't.
    return this.createPolygon<PointPolygon, any>(new PointPolygon(x, y, z), (p) => {
      const elem = this.chart.svg.circle({
        r: r * mathUtil.scaleValue(z, 0, this.axis.depth as number, 1, p.perspective as number),
        fill: color,
        'fill-opacity': this.chart.theme('polygonScatterBackgroundOpacity'),
        cx: p.vectors![0].x,
        cy: p.vectors![0].y,
      })

      if (data[target] != 0) {
        this.addEvent(elem, dataIndex, targetIndex)
      }

      return elem
    })
  }

  /** Draws every `(row, target)` cell as a 3D marker via `createScatter()`, iterating all rows
   * from `listData()` against every configured `target` field, appending each into one shared
   * group. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const datas = this.listData() as BrushData[]
    const targets = (this.brush as Record<string, unknown>).target as string[]

    for (let i = 0; i < datas.length; i++) {
      for (let j = 0; j < targets.length; j++) {
        g.append(this.createScatter(datas[i], targets[j], i, j))
      }
    }

    return g
  }

  /** Returns this brush's own default options (`size`/`clip`), merged by `defineOptions()` on top
   * of `PolygonCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return POLYGON_SCATTER3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('polygon.scatter3d', PolygonScatter3DBrush)
