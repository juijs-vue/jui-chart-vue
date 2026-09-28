// Port of legacy `src/brush/line.js` ("chart.brush.line", extend: "chart.brush.core").
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushSeriesXY, BrushTooltip } from 'jui-graph-ts'
interface LineListItem {
  element: any
  tooltip: BrushTooltip | null
}

/** `chart.brush.line`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface LineBrushOptions {
  /** Line-drawing style: straight segments, a smoothed curve through each point, or a stepped
   * (right-angle) path. */
  symbol?: 'normal' | 'curve' | 'step'
  /** Which target(s) render at full opacity by default while the rest are dimmed
   * (`lineDisableBorderOpacity`) - a target key, an array of keys, or `null` for "all at full
   * opacity" (no dimming). */
  active?: number | string | string[] | null
  /** DOM event name (e.g. `'click'`) that switches which line is `active` when it fires on a
   * line; `null` disables this per-line toggle interaction. */
  activeEvent?: string | null
  /** Which points get a permanent min/max/every-point value tooltip; `null` shows none by
   * default. */
  display?: 'max' | 'min' | 'all' | null
  /** Line stroke opacity override: a fixed number, or a function of `(data, rowIndex)` returning
   * one; the theme's `lineBorderOpacity` is used when `null`. */
  opacity?: number | ((...args: unknown[]) => number) | null
}

/** Own `chart.brush.line.setup()` fields - see legacy `line.js`. */
export const LINE_BRUSH_OWN_DEFAULTS: LineBrushOptions = {
  symbol: 'normal',
  active: null,
  activeEvent: null,
  display: null,
  opacity: null,
}

export class LineBrush extends CoreBrush {
  protected lineList: LineListItem[] = []

  protected circleColor: unknown
  protected disableOpacity: unknown
  protected lineBorderWidth: unknown
  protected lineBorderDashArray: unknown
  protected lineBorderOpacity: unknown

  private g: any

  /** Restyles every line in `lineList` (and their min/max/all-point tooltips, via
   * `tooltip.style()`) so only the line matching `elem` shows at full `lineBorderOpacity`, every
   * other line dims to `lineDisableBorderOpacity`. Wired to each line's `activeEvent` (e.g.
   * `'click'`) in `drawLine()`, for interactive single-line highlighting. */
  setActiveEffect(elem: any): void {
    const lines = this.lineList

    for (let i = 0; i < lines.length; i++) {
      const opacity = elem == lines[i].element ? this.lineBorderOpacity : this.disableOpacity
      const color = lines[i].element.get(0).attr('stroke')

      if (lines[i].tooltip != null) {
        lines[i].tooltip!.style(color, this.circleColor, opacity)
      }

      lines[i].element.attr({ opacity })
    }
  }

  /** Config-driven counterpart to `setActiveEffect`, applied once after all lines are drawn when
   * `brush.active` is set: shows each line (and its tooltip) at full opacity when its own
   * `target` key matches `active` (a single key, or is included in an `active` array), or when
   * `active` is `null` (meaning "all lines active"), dimming every other line to
   * `lineDisableBorderOpacity`. */
  setActiveEffects(): void {
    const lines = this.lineList
    const active = (this.brush as Record<string, unknown>).active as unknown
    const target = this.brush.target ?? []

    for (let i = 0; i < lines.length; i++) {
      const key = target[i]
      let opacity: unknown = this.disableOpacity
      const color = lines[i].element.get(0).attr('stroke')

      if (active === null || active === key || (Array.isArray(active) && (active as string[]).includes(key))) {
        opacity = this.lineBorderOpacity
      }

      if (lines[i].tooltip != null) {
        lines[i].tooltip!.style(color, this.circleColor, opacity)
      }

      lines[i].element.attr({ opacity })
    }
  }

  /** Registers one target's drawn line element (plus its as-yet-unset tooltip slot) into
   * `lineList`, so `setActiveEffect`/`setActiveEffects` can later restyle it by index. */
  addLineElement(elem: LineListItem): void {
    this.lineList.push(elem)
  }

  /** Builds one target's line as a group of one-or-more `<path>` segments (a new segment starts
   * whenever the resolved `color`/`opacity` for a row differs from the previous one, e.g. a
   * `colors` callback that varies per row), skipping any stretch of consecutive rows where a
   * value is `undefined`/`null` (so gaps in the data don't draw a connecting line across them).
   * Each segment is drawn as straight (`LineTo`), curved (`CurveTo`, using `curvePoints()` for
   * cubic-Bezier control points) or stepped (an extra horizontal-then-vertical `LineTo` pair at
   * the segment midpoint) depending on `symbol`. `cursor` is set to `'pointer'` whenever
   * `activeEvent` is configured, signaling the line is clickable. */
  createLine(pos: BrushSeriesXY, tIndex: number): any {
    const x = pos.x
    const y = pos.y
    const v = pos.value
    const symbol = (this.brush as Record<string, unknown>).symbol
    const px = symbol === 'curve' ? this.curvePoints(x) : null
    const py = symbol === 'curve' ? this.curvePoints(y) : null
    let color: unknown = null
    let opacity: unknown = null
    const opts = {
      'stroke-width': this.lineBorderWidth,
      'stroke-dasharray': this.lineBorderDashArray,
      fill: 'transparent',
      cursor: (this.brush as Record<string, unknown>).activeEvent != null ? 'pointer' : 'normal',
    }

    const g = this.svg.group()
    let p: any = null

    if (pos.length > 0) {
      let start: number | null = null
      let end: number | null = null

      for (let i = 0; i < x.length - 1; i++) {
        if (v[i] !== undefined && v[i] !== null) start = i
        if (v[i + 1] !== undefined && v[i + 1] !== null) end = i + 1

        if (start == null || end == null || start === end) continue

        const newColor = this.color(i, tIndex)
        const newOpacity = this.getOpacity(i)

        if (color != newColor || opacity != newOpacity) {
          p = this.svg.path({
            ...opts,
            'stroke-opacity': newOpacity,
            stroke: newColor,
            x1: x[start],
          })

          p.css({ 'pointer-events': 'stroke' })

          p.MoveTo(x[start], y[start])
          g.append(p)

          color = newColor
          opacity = newOpacity
        } else {
          p.attr({ x2: x[end] })
        }

        if (symbol === 'curve') {
          p.CurveTo(px!.p1[start], py!.p1[start], px!.p2[start], py!.p2[start], x[end], y[end])
        } else {
          if (symbol === 'step') {
            const sx = x[start] + (x[end] - x[start]) / 2

            p.LineTo(sx, y[start])
            p.LineTo(sx, y[end])
          }

          p.LineTo(x[end], y[end])
        }
      }
    }

    return g
  }

  /** Draws a permanent value tooltip (`drawTooltip()`) at each point matching `display`
   * (`'max'`/`'min'` points only, or `'all'` points), oriented above the line for a max point and
   * below it otherwise. For `'max'`/`'min'` mode only the first matching point creates a tooltip
   * per line (reused/positioned via `lineList[index].tooltip`, checked via `tooltip == null`);
   * `'all'` mode creates a fresh tooltip for every matching point. */
  createTooltip(g: any, pos: BrushSeriesXY, index: number): void {
    const display = (this.brush as Record<string, unknown>).display

    for (let i = 0; i < pos.x.length; i++) {
      if ((display === 'max' && pos.max[i]) || (display === 'min' && pos.min[i]) || display === 'all') {
        const orient = display === 'max' && pos.max[i] ? 'top' : 'bottom'
        const tooltip = this.lineList[index].tooltip

        if (display === 'all' || tooltip == null) {
          const minmax = this.drawTooltip(this.color(index), this.circleColor, this.lineBorderOpacity)
          minmax.control(orient, +pos.x[i], +pos.y[i], this.format(pos.value[i]))

          g.append(minmax.tooltip)
          this.lineList[index].tooltip = minmax
        }
      }
    }
  }

  /** Resolves the stroke opacity for a line/segment: `brush.opacity` called with `(data, index)`
   * when it's a function and `rowIndex` is a number, the configured number directly, or the
   * theme's `lineBorderOpacity` when `opacity` is unset (or `rowIndex` is `null`, as in
   * `drawBefore()`'s initial call). */
  getOpacity(rowIndex: number | null): number {
    const opacity = (this.brush as Record<string, unknown>).opacity
    const defOpacity = this.chart.theme('lineBorderOpacity') as number

    if (typeof opacity === 'function' && typeof rowIndex === 'number') {
      return (opacity as (this: unknown, data: unknown, index: number) => number).call(this.chart, this.getData(rowIndex), rowIndex)
    } else if (typeof opacity === 'number') {
      return opacity
    }

    return defOpacity
  }

  /** Draws every target's line (`createLine()` per entry in `path`, one per `getXY()` result),
   * wires each line's click/hover events (`addEvent`) and, when `activeEvent` is set, its
   * active-toggle handler (`setActiveEffect`), draws each line's tooltip(s) when `display` is
   * set, and finally applies the initial `active` highlighting (`setActiveEffects()`) once all
   * lines exist. Returns the brush's group. */
  drawLine(path: BrushSeriesXY[]): any {
    for (let k = 0; k < path.length; k++) {
      const p = this.createLine(path[k], k)

      this.addEvent(p, undefined, k)
      this.g.append(p)

      this.addLineElement({ element: p, tooltip: null })

      if ((this.brush as Record<string, unknown>).display != null) {
        this.createTooltip(this.g, path[k], k)
      }

      if ((this.brush as Record<string, unknown>).activeEvent != null) {
        const elem = p
        elem.on((this.brush as Record<string, unknown>).activeEvent, () => {
          this.setActiveEffect(elem)
        })
      }
    }

    if ((this.brush as Record<string, unknown>).active != null) {
      this.setActiveEffects()
    }

    return this.g
  }

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. Caches
   * the shared tooltip-marker color and the theme's line-stroke width/dash-array/opacity so
   * `createLine()`/`createTooltip()` don't re-read the theme per point; `lineBorderOpacity` is
   * resolved once via `getOpacity(null)` (i.e. the static/default opacity, since no row index is
   * meaningful yet). */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.circleColor = this.chart.theme('linePointBorderColor')
    this.disableOpacity = this.chart.theme('lineDisableBorderOpacity')
    this.lineBorderWidth = this.chart.theme('lineBorderWidth')
    this.lineBorderDashArray = this.chart.theme('lineBorderDashArray')
    this.lineBorderOpacity = this.getOpacity(null)
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Resolves every
   * target's `{x, y, value}` series via the inherited `CoreBrush.getXY()` and hands it to
   * `drawLine()`. */
  draw = (): any => {
    return this.drawLine(this.getXY())
  }

  /** Arrow-function class field overriding `Draw`'s optional animation hook. For each drawn
   * element under `root` that exposes a `.join`/path-length API (i.e. an actual `<path>`, not a
   * plain group): if it has no existing dash array (`'none'`), animates it drawing on by sliding
   * `stroke-dashoffset` from its full length to `0`; otherwise (already dashed, e.g. via
   * `lineBorderDashArray`) fades it in via `opacity` instead, since animating dash-offset on an
   * already-dashed stroke wouldn't read as a clean "draw-on" effect. */
  drawAnimate = (root: any): void => {
    const svg = this.chart.svg

    root.each((_i: number, elem: any) => {
      if (typeof elem.join === 'function') {
        const dash = elem.attributes['stroke-dasharray']
        const len = elem.length()

        if (dash == 'none') {
          elem.attr({ 'stroke-dasharray': len })

          elem.append(
            svg.animate({
              attributeName: 'stroke-dashoffset',
              from: len,
              to: '0',
              begin: '0s',
              dur: '1s',
              repeatCount: '1',
            }),
          )
        } else {
          elem.append(
            svg.animate({
              attributeName: 'opacity',
              from: '0',
              to: '1',
              begin: '0s',
              dur: '1.5s',
              repeatCount: '1',
              fill: 'freeze',
            }),
          )
        }
      }
    })
  }

  /** Returns this brush's own config defaults (`LINE_BRUSH_OWN_DEFAULTS`). `jui-graph-ts`'s
   * `defineOptions()` now walks the full `LineBrush -> CoreBrush -> Draw` chain itself, so this
   * only needs to return `LineBrush`'s own legacy defaults (1:1 with `line.js`). */
  static setup(): Record<string, unknown> {
    return LINE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('line', LineBrush)
