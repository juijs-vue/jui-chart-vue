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

  addLineElement(elem: LineListItem): void {
    this.lineList.push(elem)
  }

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

  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.circleColor = this.chart.theme('linePointBorderColor')
    this.disableOpacity = this.chart.theme('lineDisableBorderOpacity')
    this.lineBorderWidth = this.chart.theme('lineBorderWidth')
    this.lineBorderDashArray = this.chart.theme('lineBorderDashArray')
    this.lineBorderOpacity = this.getOpacity(null)
  }

  draw = (): any => {
    return this.drawLine(this.getXY())
  }

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

  // `jui-graph-ts`'s `defineOptions()` now walks the full `LineBrush -> CoreBrush -> Draw` chain
  // itself, so this only needs to return `LineBrush`'s own legacy defaults (1:1 with `line.js`).
  static setup(): Record<string, unknown> {
    return LINE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('line', LineBrush)
