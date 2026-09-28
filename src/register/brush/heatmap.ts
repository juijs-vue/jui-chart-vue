// Port of legacy `src/brush/heatmap.js` ("chart.brush.heatmap", extend: "chart.brush.core") -
// extends `CoreBrush` directly. Renders one cell per `axis.data` ROW (not per `target` value - this
// brush never reads `brush.target` at all), positioned at `(axis.x(i), axis.y(i))` (the ROW INDEX,
// via each axis's own "numeric arg = index" convention), with an optional text label.
//
// **Preserved quirk, easy to miss - but ONLY when `brush.colors` is left at its default `null`**:
// `this.color(i, null)` passes an explicit `null` (not omitted) as the second argument.
// `CoreBrush.color(key1, key2)` dispatches on `typeCheck("undefined", key2)`, not on whether
// `colors` itself is set - a `null` second arg is NOT `undefined`, so it takes the
// `colorIndex=key2(=null), rowIndex=key1(=i)` branch. With the default `colors: null` (not a
// function), this falls through to `chart.color(null, null)` -> `nextColor()` with `index=null` ->
// `c[null]` is `undefined` (JS array indexing on a non-numeric key) -> `createColor(undefined)`
// returns the literal string `"none"` - hence the very next line's `if (color == "none") { color =
// theme("heatmapBackgroundColor") }` fallback: with NO `colors` callback configured, every cell
// gets the SAME uniform background color, never a real per-row themed color. HOWEVER, when
// `brush.colors` IS a function (the real, intended usage - confirmed via a real legacy demo,
// `heatmap1.js`, which always configures one), `CoreBrush.color()` takes a completely different
// branch: `rowIndex` (still `key1`, since `colorIndex` is discarded in the function branch) is
// passed to the callback as `this.getData(rowIndex)`/`rowIndex`, and the callback's own returned
// color string is used directly - real per-cell coloring, unaffected by the `null` quirk above.
// Ported literally either way (not "fixed" to call `this.color(i)` without the `null`, which would
// change the no-`colors`-callback case's rendered output).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.heatmap`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions` - see
 * this file's header comment for a real, easy-to-miss gotcha in how inherited `colors` interacts
 * with per-cell coloring here). */
export interface HeatmapBrushOptions {
  /** Formats the value shown in each cell's label; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.heatmap.setup()` fields - see legacy `heatmap.js`. */
export const HEATMAP_BRUSH_OWN_DEFAULTS: HeatmapBrushOptions = {
  format: null,
}

export class HeatmapBrush extends CoreBrush {
  /** Draws one cell per `axis.data` row (never reads `brush.target` - see this file's header
   * comment), positioned at `(axis.x(i), axis.y(i))` (the row's own index, not a data value), sized
   * to the axis's row band minus the border width on each axis. Each cell's fill comes from
   * `this.color(i, null)` (see header comment for the real quirk this triggers when `brush.colors`
   * isn't a function: every cell falls through to the SAME `heatmapBackgroundColor`, not a
   * per-row color), with a hover effect that raises its `fill-opacity` to
   * `heatmapHoverBackgroundOpacity`. Each cell's label is `brush.format(data)` when `format` is a
   * function, otherwise the row's own `text` field. */
  draw = (): any => {
    const bw = this.chart.theme('heatmapBorderWidth') as number
    const fs = this.chart.theme('heatmapFontSize') as number
    const g = this.svg.group()
    const w = (this.axis.x as BrushAxisScale).rangeBand!() - bw
    const h = (this.axis.y as BrushAxisScale).rangeBand!() - bw

    for (let i = 0; i < this.axis.data.length; i++) {
      const group = this.svg.group()
      let color = this.color(i, null as unknown as number)
      const data = this.axis.data[i] as BrushData
      const text = this.getValue(data, 'text', undefined)
      const cx = (this.axis.x as BrushAxisScale)(i)
      const cy = (this.axis.y as BrushAxisScale)(i)

      if (color == 'none') {
        color = this.chart.theme('heatmapBackgroundColor') as string
      }

      const r = this.svg.rect({
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        fill: color,
        'fill-opacity': this.chart.theme('heatmapBackgroundOpacity'),
        stroke: this.chart.theme('heatmapBorderColor'),
        'stroke-opacity': this.chart.theme('heatmapBorderOpacity'),
        'stroke-width': bw,
      })

      const t = this.chart
        .text({
          'text-anchor': 'middle',
          fill: this.chart.theme('heatmapFontColor'),
          'font-size': fs,
          width: w,
          height: h,
          x: cx,
          y: cy + fs / 2,
        })
        .text((typeof (this.brush as Record<string, unknown>).format === 'function' ? this.format(data) : text) as string)

      this.addEvent(group, i, null)

      group.append(r)
      group.append(t)
      g.append(group)

      group.hover(
        () => {
          r.attr({ 'fill-opacity': this.chart.theme('heatmapHoverBackgroundOpacity') })
        },
        () => {
          r.attr({ 'fill-opacity': this.chart.theme('heatmapBackgroundOpacity') })
        },
      )
    }

    return g
  }

  /** Returns this brush's own default options (`format`), merged by `defineOptions()` on top of the
   * inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return HEATMAP_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('heatmap', HeatmapBrush)
