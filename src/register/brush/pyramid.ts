// Port of legacy `src/brush/pyramid.js` ("chart.brush.pyramid", extend: "chart.brush.core") -
// extends `CoreBrush` directly. Like `PieBrush`/`BarGaugeBrush`, only ever reads `axis.data[0]`
// (a second data row is silently ignored) and is NOT axis-scale-based - the only positioning input
// is `this.axis.area()`, consumed via its own from-scratch trig, not a shared axis scale. Draws a
// single solid triangle (apex top, full-width base bottom, by default; `reverse: true` flips it to
// an inverted funnel) inscribed in the plot area; each target's segment is a trapezoid slice sized
// by `rate = value / total`, sorted by value DESCENDING before drawing (so the largest segment is
// the wide base). Cross-checked against `main` branch's `usePyramid.ts` header comment - confirmed
// the same visual model, EXCEPT: `usePyramid.ts` deliberately guards `total === 0` to avoid a NaN
// `rate` (a real fix, not a faithful port) - this port does NOT add that guard, since the legacy
// source divides unconditionally and a documented `0`-total row upstream would genuinely produce a
// broken/NaN-positioned pyramid; preserved as-is per this project's "port bugs faithfully" rule.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** `chart.brush.pyramid`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). Only
 * ever reads the FIRST data row (`axis.data[0]`) - a second row is silently ignored. */
export interface PyramidBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `pyramid.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** Shows each segment's value/label text on its trapezoid slice. */
  showText?: boolean
  /** Formats the value shown in each segment's text; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
  /** Draws an inverted funnel (apex at the bottom) instead of the default upright triangle (apex
   * at the top). */
  reverse?: boolean
}

/** Own `chart.brush.pyramid.setup()` fields - see legacy `pyramid.js`. */
export const PYRAMID_BRUSH_OWN_DEFAULTS: PyramidBrushOptions = {
  clip: false,
  showText: false,
  format: null,
  reverse: false,
}

interface PyramidSegment {
  key: string
  value: number
  rate: number
  index: number
}

/** Builds one `PyramidSegment` per `targets` key present on `obj` (the first, and only, data row -
 * see this file's header comment), computing each one's `rate = value / total` (no `total === 0`
 * guard - see header comment) and sorting the result by `value` DESCENDING, so `draw()`'s loop
 * naturally produces the widest segment first (the base of the pyramid/funnel). Not exported;
 * internal to this file. */
function getCalculatedData(obj: BrushData, targets: string[]): PyramidSegment[] {
  let total = 0
  const list: PyramidSegment[] = []

  for (const key in obj) {
    const index = targets.indexOf(key)
    if (index == -1) continue

    total += obj[key] as number

    list.push({ key, value: obj[key] as number, rate: 0, index })
  }

  for (let i = 0; i < list.length; i++) {
    list[i].rate = list[i].value / total
  }

  list.sort((a, b) => b.value - a.value)

  return list
}

export class PyramidBrush extends CoreBrush {
  /** Draws one segment's label as a leader line from `(cx, cy)` out to `(cx + pyramidTextLineSize,
   * y)` plus the text itself just past its end. `dist` is the vertical distance to the PREVIOUS
   * segment's label y (`textY - ty2` in `draw()`'s loop) - when it's a small positive gap (less
   * than the leader-line length), the label is nudged up by half that gap to reduce label
   * overlap between adjacent thin segments. */
  createText(text: unknown, cx: number, cy: number, dist: number): any {
    const l_size = this.chart.theme('pyramidTextLineSize') as number
    const f_size = this.chart.theme('pyramidTextFontSize') as number
    const x = cx + l_size
    const y = cy + (dist > 0 && dist < l_size ? cy - dist / 2 : 0)

    const g = this.svg.group()

    const l = this.svg.line({
      stroke: this.chart.theme('pyramidTextLineColor'),
      'stroke-width': this.chart.theme('pyramidTextLineWidth'),
      x1: cx,
      y1: cy,
      x2: x,
      y2: y,
    })

    const t = this.chart
      .text({
        'font-size': this.chart.theme('pyramidTextFontSize'),
        fill: this.chart.theme('pyramidTextFontColor'),
        x,
        y,
        dx: 3,
        dy: f_size / 3,
      })
      .text(text as string)

    g.append(l)
    g.append(t)

    return g
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Reads only the
   * FIRST data row (`axis.data[0]`, or `{}` when there are no rows - see header comment), computes
   * each target's trapezoid slice via `getCalculatedData()`, then walks the sorted segments from
   * the base inward: each iteration narrows the running `(startX, endX)`/`(dy)` span by that
   * segment's `rate`-proportional share of the plot area's diagonal distance, flipped vertically
   * when `reverse` is set (funnel apex at the bottom instead of the top). Draws each segment's
   * trapezoid polygon (`addEvent()`-wired), an optional divider line between segments, and -
   * when `showText` is set - a label via `createText()`. */
  draw = (): any => {
    const g = this.svg.group()
    const obj = this.axis.data.length > 0 ? (this.axis.data[0] as BrushData) : {}
    const data = getCalculatedData(obj, this.brush.target ?? [])
    const area = this.axis.area()
    const dx = area.width / 2
    let dy = area.height

    let startX = 0
    let endX = dx * 2
    const startRad = Math.atan2(dy, dx)
    const distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
    let textY = 0
    const isReverse = (this.brush as Record<string, unknown>).reverse

    if (isReverse) dy = 0

    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const dist = d.rate * distance
      const sx = startX + dist * Math.cos(startRad)
      const ex = endX - dist * Math.cos(-startRad)
      const ty = dist * Math.sin(startRad)
      const y = isReverse ? dy + ty : dy - ty

      const poly = this.svg.polygon({
        fill: this.color(i),
        'stroke-width': 0,
      })

      this.addEvent(poly, 0, d.index)
      g.append(poly)

      if (i > 0) {
        const width = this.chart.theme('pyramidLineWidth') as number

        const line = this.svg.line({
          stroke: this.chart.theme('pyramidLineColor'),
          'stroke-width': width,
          x1: startX - width / 2,
          y1: dy,
          x2: endX + width / 2,
          y2: dy,
        })

        line.translate(area.x, area.y)
        g.append(line)
      }

      if ((this.brush as Record<string, unknown>).showText) {
        const tx = (ex + endX) / 2
        const ty2 = (y + dy) / 2

        const format = (this.brush as Record<string, unknown>).format
        const text = this.createText(typeof format === 'function' ? this.format(d.key, d.value, d.rate) : d.value, tx, ty2, textY - ty2)

        text.translate(area.x, area.y)

        g.append(text)
        textY = ty2
      }

      poly.point(startX, dy)
      poly.point(sx, y)
      poly.point(ex, y)
      poly.point(endX, dy)
      poly.translate(area.x, area.y)

      startX = sx
      endX = ex
      dy = y
    }

    return g
  }

  /** Returns this brush's own config defaults (`PYRAMID_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return PYRAMID_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('pyramid', PyramidBrush)
