// Port of legacy `src/brush/scatter.js` ("chart.brush.scatter", extend: "chart.brush.core") -
// extends `CoreBrush` directly. Renders one marker per (row, target) point, shape driven by
// `brush.symbol` ("circle" default/ellipse, "rectangle"/"rect", "triangle", "cross" - two crossed
// lines, no fill/stroke/hover styling applied per the legacy `if (symbol.uri != "cross")` guard -
// or an `<image>` when `symbol` is a callback returning an arbitrary string that isn't one of the
// four named shapes).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushSeriesXY } from 'jui-graph-ts'

interface ScatterSymbol {
  type: 'default' | 'image'
  uri: unknown
}

/** `chart.brush.scatter`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions` -
 * `clip` is redeclared here with a different default (`false`) than `BrushOptions`'s own
 * `true`). */
export interface ScatterBrushOptions {
  /** Marker shape: `'circle'`/`'rectangle'`/`'rect'`/`'triangle'`/`'cross'` (cross gets no
   * fill/stroke/hover styling), or a function of `(target, value)` returning one of those names
   * or an arbitrary image URL (rendered as an `<image>`). */
  symbol?: string | ((...args: unknown[]) => unknown)
  /** Marker width/height in px. */
  size?: number
  /** Renders every marker at `opacity: 0` (still present/interactive, just invisible) - useful
   * for a hover/click-only overlay. */
  hide?: boolean
  /** Skips drawing a marker entirely for any point whose value is exactly `0`. */
  hideZero?: boolean
  /** On hover, restyles every marker in the same row (not just the hovered one) together. */
  hoverSync?: boolean
  /** DOM event name (e.g. `'click'`) that highlights a marker and shows its value in a floating
   * tooltip when it fires; `null` disables this per-marker toggle interaction. */
  activeEvent?: string | null
  /** Which points get a permanent min/max/every-point value tooltip; `null` shows none by
   * default. */
  display?: 'max' | 'min' | 'all' | null
  /** Marker fill/background opacity. */
  opacity?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `scatter.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.scatter.setup()` fields - see legacy `scatter.js`. */
export const SCATTER_BRUSH_OWN_DEFAULTS: ScatterBrushOptions = {
  symbol: 'circle',
  size: 7,
  hide: false,
  hideZero: false,
  hoverSync: false,
  activeEvent: null,
  display: null,
  opacity: 1,
  clip: false,
}

export class ScatterBrush extends CoreBrush {
  protected cachedSymbol: Record<number, any[]> = {}
  protected activeScatter: any = null
  protected activeTooltip: any = null

  /** Resolves the marker shape for one point: when `symbol` is a function, calls it with
   * `(target, value)` and classifies the result as `'default'` (one of the four named shapes) or
   * `'image'` (any other string, treated as an image URL); otherwise just wraps the configured
   * static `symbol` string as `'default'`. */
  getSymbolType(key: number, value: unknown): ScatterSymbol {
    const symbol = (this.brush as Record<string, unknown>).symbol
    const target = (this.brush.target ?? [])[key]

    if (typeof symbol === 'function') {
      const res = (symbol as (...a: unknown[]) => unknown).apply(this.chart, [target, value])

      if (res == 'triangle' || res == 'cross' || res == 'rectangle' || res == 'rect' || res == 'circle') {
        return { type: 'default', uri: res }
      } else {
        return { type: 'image', uri: res }
      }
    }

    return { type: 'default', uri: symbol }
  }

  /** Builds one point's marker element for the shape `symbol` resolved to: an `<image>` for
   * `'image'`-type symbols, or for `'default'` a triangle/cross (drawn as a small group of
   * polygon/lines), rectangle, or ellipse (the fallback for `'circle'` and anything else).
   * `'cross'` markers get no fill/stroke/hover styling at all (its own two `<line>`s are already
   * fully styled) - every other default shape gets fill/border/hover wiring here, dimming on
   * mouseout to `0` opacity when `hide` is set, and - when `hoverSync` is set - restyling every
   * OTHER marker in the same row (`cachedSymbol[dataIndex]`) together with the hovered one instead
   * of just itself. Hover is skipped entirely for whichever marker is currently `activeScatter`. */
  createScatter(pos: { x: number; y: number; value: unknown }, dataIndex: number, targetIndex: number, symbol: ScatterSymbol): any {
    const w = (this.brush as Record<string, unknown>).size as number
    const h = (this.brush as Record<string, unknown>).size as number

    const color = this.color(dataIndex, targetIndex)
    const borderColor = this.chart.theme('scatterBorderColor')
    const borderWidth = this.chart.theme('scatterBorderWidth') as number
    const bgOpacity = (this.brush as Record<string, unknown>).opacity

    let elem: any = null

    if (symbol.type == 'image') {
      elem = this.chart.svg.image({
        'xlink:href': symbol.uri,
        width: w + borderWidth,
        height: h + borderWidth,
        x: pos.x - w / 2 - borderWidth,
        y: pos.y - h / 2,
      })
    } else {
      if (symbol.uri == 'triangle' || symbol.uri == 'cross') {
        elem = this.chart.svg
          .group(
            {
              width: w,
              height: h,
              opacity: bgOpacity,
            },
            () => {
              if (symbol.uri == 'triangle') {
                const poly = this.chart.svg.polygon()

                poly.point(0, h).point(w, h).point(w / 2, 0)
              } else {
                this.chart.svg.line({ stroke: color, 'stroke-width': borderWidth * 2, x1: 0, y1: 0, x2: w, y2: h })
                this.chart.svg.line({ stroke: color, 'stroke-width': borderWidth * 2, x1: 0, y1: w, x2: h, y2: 0 })
              }
            },
          )
          .translate(pos.x - w / 2, pos.y - h / 2)
      } else {
        if (symbol.uri == 'rectangle' || symbol.uri == 'rect') {
          elem = this.chart.svg.rect({
            width: w,
            height: h,
            x: pos.x - w / 2,
            y: pos.y - h / 2,
            opacity: bgOpacity,
          })
        } else {
          elem = this.chart.svg.ellipse({
            rx: w / 2,
            ry: h / 2,
            cx: pos.x,
            cy: pos.y,
            opacity: bgOpacity,
          })
        }
      }

      if (symbol.uri != 'cross') {
        elem
          .attr({
            fill: color,
            stroke: borderColor,
            'stroke-width': borderWidth,
          })
          .hover(
            () => {
              if (elem == this.activeScatter) return

              const opts: Record<string, unknown> = {
                fill: this.chart.theme('scatterHoverColor'),
                stroke: color,
                'stroke-width': borderWidth * 2,
                opacity: bgOpacity,
              }

              if ((this.brush as Record<string, unknown>).hoverSync) {
                for (let i = 0; i < this.cachedSymbol[dataIndex].length; i++) {
                  opts.stroke = this.color(dataIndex, i)
                  this.cachedSymbol[dataIndex][i].attr(opts)
                }
              } else {
                elem.attr(opts)
              }
            },
            () => {
              if (elem == this.activeScatter) return

              const opts: Record<string, unknown> = {
                fill: color,
                stroke: borderColor,
                'stroke-width': borderWidth,
                opacity: (this.brush as Record<string, unknown>).hide ? 0 : bgOpacity,
              }

              if ((this.brush as Record<string, unknown>).hoverSync) {
                for (let i = 0; i < this.cachedSymbol[dataIndex].length; i++) {
                  opts.fill = this.color(dataIndex, i)
                  this.cachedSymbol[dataIndex][i].attr(opts)
                }
              } else {
                elem.attr(opts)
              }
            },
          )
      }
    }

    return elem
  }

  /** Draws every target's points (resets `cachedSymbol` first, so a redraw doesn't keep stale
   * references from a prior one). Skips a point entirely when `hideZero` is set and its value is
   * `0`, or when its value is `undefined`/`null` (a genuine data gap, not just a zero). Caches
   * only "plain colorable" markers (`type === 'default'` and not `'cross'`) into
   * `cachedSymbol[targetIndex]` for `hoverSync`/`activeEvent` to restyle later. Draws a permanent
   * tooltip at points matching `display` (same `'max'`/`'min'`/`'all'` semantics as `LineBrush`'s
   * `createTooltip`, but here only ONE tooltip total is ever drawn for `'max'`/`'min'` mode across
   * the WHOLE brush via `isTooltipDraw`, not one per target/line). When `activeEvent` is
   * configured, wires it to swap `activeScatter`'s highlight to the clicked marker and reposition
   * the single shared `activeTooltip` (created once, appended after the loop) to show that point's
   * value. `hide` renders every marker at `opacity: 0` (still interactive). */
  drawScatter(points: BrushSeriesXY[]): any {
    this.cachedSymbol = {}

    const g = this.chart.svg.group()
    const borderColor = this.chart.theme('scatterBorderColor')
    const borderWidth = this.chart.theme('scatterBorderWidth') as number
    const bgOpacity = (this.brush as Record<string, unknown>).opacity
    let isTooltipDraw = false

    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points[i].x.length; j++) {
        if (!this.cachedSymbol[j]) {
          this.cachedSymbol[j] = []
        }

        if ((this.brush as Record<string, unknown>).hideZero && points[i].value[j] === 0) {
          continue
        }

        const data = {
          x: points[i].x[j],
          y: points[i].y[j],
          max: points[i].max[j],
          min: points[i].min[j],
          value: points[i].value[j],
        }

        if (data.value === undefined || data.value === null) continue

        const symbol = this.getSymbolType(i, data.value)
        const p = this.createScatter(data, j, i, symbol)
        const d = (this.brush as Record<string, unknown>).display

        if (symbol.type == 'default' && symbol.uri != 'cross') {
          this.cachedSymbol[j].push(p)
        }

        if ((d == 'max' && data.max) || (d == 'min' && data.min) || d == 'all') {
          if (d == 'all' || !isTooltipDraw) {
            g.append(this.drawTooltip(data.x, data.y, this.format(data.value)))
            isTooltipDraw = true
          }
        }

        if ((this.brush as Record<string, unknown>).activeEvent != null) {
          const scatter = p
          const x = data.x
          const y = data.y
          const text = this.format(data.value)
          const color = this.color(j, i)
          const symbolForHandler = this.getSymbolType(i, data.value)

          scatter.on((this.brush as Record<string, unknown>).activeEvent, () => {
            if (symbolForHandler.type == 'default' && symbolForHandler.uri != 'cross') {
              if (this.activeScatter != null) {
                this.activeScatter.attr({
                  fill: this.activeScatter.attributes['stroke'],
                  stroke: borderColor,
                  'stroke-width': borderWidth,
                  opacity: (this.brush as Record<string, unknown>).hide ? 0 : bgOpacity,
                })
              }

              this.activeScatter = scatter
              this.activeScatter.attr({
                fill: this.chart.theme('scatterHoverColor'),
                stroke: color,
                'stroke-width': borderWidth * 2,
                opacity: bgOpacity,
              })
            }

            this.activeTooltip.html(text as string)
            this.activeTooltip.translate(x, y)
          })

          scatter.attr({ cursor: 'pointer' })
        }

        if ((this.brush as Record<string, unknown>).hide) {
          p.attr({ opacity: 0 })
        }

        this.addEvent(p, j, i)
        g.append(p)
      }
    }

    this.activeTooltip = this.drawTooltip(0, 0, '')
    g.append(this.activeTooltip)

    return g
  }

  /** Builds a simple text-only tooltip positioned `size` px above `(x, y)` - distinct from the
   * inherited `CoreBrush.drawTooltip()` (text+circle marker); this brush's own simpler override,
   * used both for the permanent min/max/all tooltips and the single shared `activeTooltip`. */
  drawTooltip(x: number, y: number, text: unknown): any {
    return this.chart
      .text(
        {
          y: -((this.brush as Record<string, unknown>).size as number),
          'text-anchor': 'middle',
          fill: this.chart.theme('tooltipPointFontColor'),
          'font-size': this.chart.theme('tooltipPointFontSize'),
          'font-weight': this.chart.theme('tooltipPointFontWeight'),
          opacity: (this.brush as Record<string, unknown>).opacity,
        },
        text as string,
      )
      .translate(x, y)
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Resolves every
   * target's `{x, y, value, min, max}` series via the inherited `CoreBrush.getXY()` and hands it
   * to `drawScatter()`. */
  draw = (): any => {
    return this.drawScatter(this.getXY())
  }

  /** Arrow-function class FIELD (unlike `BarBrush`/`ColumnBrush`/`BubbleBrush`'s own `drawAnimate`,
   * which take a `root` param): legacy `scatter.js`'s own `drawAnimate` takes NO parameters at all
   * and returns the created `<animateTransform>` WITHOUT appending it anywhere (`Draw.render()`
   * discards `drawAnimate()`'s return value) - so this element attaches directly to the SVG's
   * `mainGroup` (via `svg.animateTransform()`'s own `create()` call, since nothing is nested at
   * this call depth), not nested inside this brush's own drawn group at all. A real, preserved
   * legacy oddity - ported literally, not "fixed" to actually animate the scatter's own group. */
  drawAnimate = (): any => {
    // `jui-graph-ts`'s own `BrushChart` interface (`brush/core.ts`) only declares the single-key
    // overload of `area(key: string): number`, not `Builder`'s real zero-arg `area(): AreaBox`
    // form this legacy call needs (every other `CoreBrush`-family call site only ever needs the
    // keyed form) - cast locally rather than widening the shared interface for this one call site;
    // flagged in this task's report as a minor, easy, low-risk addition if a future brush needs it
    // too.
    const area = (this.chart.area as unknown as () => { x: number; y: number; height: number })()

    return this.chart.svg.animateTransform({
      attributeName: 'transform',
      type: 'translate',
      from: area.x + ' ' + area.height,
      to: area.x + ' ' + area.y,
      begin: '0s',
      dur: '0.4s',
      repeatCount: '1',
    })
  }

  /** Returns this brush's own config defaults (`SCATTER_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return SCATTER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('scatter', ScatterBrush)
