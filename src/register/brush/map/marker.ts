// Port of legacy `src/brush/map/marker.js` ("chart.brush.map.marker", extend:
// "chart.brush.map.core") - drops an arbitrary HTML (`<foreignObject>`) and/or raw SVG marker at
// each data row's `axis.map(id)` position.
import { registerBrush, MapCoreBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type MapScaleFn = (id: string) => { x: number; y: number } | undefined

/** `chart.brush.map.marker`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface MapMarkerBrushOptions {
  /** Marker width in px (also the `<foreignObject>` width for `html`). */
  width?: number
  /** Marker height in px (also the `<foreignObject>` height for `html`). */
  height?: number
  /** Raw HTML string (or a per-row callback returning one) rendered inside a `<foreignObject>`
   * centered on the row's map position; no HTML marker drawn when omitted/returns falsy. */
  html?: string | ((this: unknown, data: BrushData) => string) | null
  /** Raw SVG markup string (or a per-row callback returning one) rendered as a `<g>` centered on
   * the row's map position; no SVG marker drawn when omitted/returns falsy. Independent of
   * `html` - both can render at once. */
  svg?: string | ((this: unknown, data: BrushData) => string) | null
}

/** Own `chart.brush.map.marker.setup()` fields - see legacy `map/marker.js`. */
export const MAP_MARKER_BRUSH_OWN_DEFAULTS: MapMarkerBrushOptions = {
  width: 0,
  height: 0,
  html: null,
  svg: null,
}

export class MapMarkerBrush extends MapCoreBrush {
  /** Draws every row's marker(s), skipping rows whose `id` doesn't resolve to a map position.
   * `html`/`svg` are each resolved per row (calling them with the row as the argument, `this` bound
   * to `this.chart`, when they're functions) and only rendered when the resolved value is a
   * non-empty string - `html` as a `<foreignObject>` of `width`x`height`, `svg` as a plain `<g>`
   * with its markup injected via `.html()`, both centered on the row's map position (top-left
   * corner offset by half `width`/`height`). The two are independent - a row can render an HTML
   * marker, an SVG marker, both, or neither. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const brush = this.brush as Record<string, unknown>
    const w = brush.width as number
    const h = brush.height as number

    this.eachData((d) => {
      const row = d as BrushData
      const id = this.axis.getValue(row, 'id', null) as string
      const xy = ((this.axis as unknown as Record<string, unknown>).map as unknown as MapScaleFn)(id)

      if (xy != null) {
        const html = typeof brush.html === 'function' ? (brush.html as (this: unknown, data: BrushData) => string).call(this.chart, row) : brush.html
        const svg = typeof brush.svg === 'function' ? (brush.svg as (this: unknown, data: BrushData) => string).call(this.chart, row) : brush.svg
        const cx = xy.x - w / 2
        const cy = xy.y - h / 2

        if (typeof html === 'string' && html != '') {
          const obj = this.chart.svg.foreignObject({ width: w, height: h }).html(html).translate(cx, cy)

          g.append(obj)
        }

        if (typeof svg === 'string' && svg != '') {
          const obj = this.chart.svg.group()
          obj.html(svg).translate(cx, cy)

          g.append(obj)
        }
      }
    })

    return g
  }

  /** Returns this brush's own default options (`width`/`height`/`html`/`svg`), merged by
   * `defineOptions()` on top of `MapCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return MAP_MARKER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('map.marker', MapMarkerBrush)
