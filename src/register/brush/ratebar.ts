// Port of legacy `src/brush/ratebar.js` ("chart.brush.ratebar", extend: "chart.brush.core") -
// extends `CoreBrush` DIRECTLY (confirmed from the legacy file's own `extend:` field) - shares NO
// code with `BarBrush`/`StackBarBrush` (writes its own `createBarElement`/`draw`/
// `setActiveBarElement` from scratch). Only one orientation exists upstream (no "ratecolumn"
// sibling): x is always the range/value axis, y always the block/category axis.
//
// Each ROW renders as one horizontal pill-shaped bar split into contiguous colored segments, one
// per `target` key whose value is `> 0` (a zero/negative value's target is skipped entirely - not
// rendered as a zero-width placeholder). Each segment's width is that key's share of the ROW's own
// total (`axis.x.rate(value, sumValues)`), so a row's bar always fills the full plot width
// regardless of its raw total - closer to `fullstackbar.js`'s normalized mode than to a
// single-value "progress toward a goal" widget.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

interface RateBarStyle {
  fontColor: unknown
  fontSize: unknown
  borderColor: unknown
  borderWidth: unknown
  borderRadius: number
  disableOpacity: unknown
  tooltipFontColor: unknown
  tooltipFontSize: unknown
  tooltipBackgroundColor: unknown
  tooltipBorderColor: unknown
  disableBackgroundOpacity: unknown
}

/** `chart.brush.ratebar`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface RateBarBrushOptions {
  /** Index of the row whose bar shows a permanent active/highlighted state on mount. */
  activeIndex?: number | null
  /** Target key within the active row's bar to highlight; `null` highlights the whole bar. */
  activeTarget?: string | null
  /** DOM event name (e.g. `'click'`) that toggles a segment's active/highlighted state; `null`
   * disables this per-segment toggle interaction. */
  activeEvent?: string | null
  /** Formats the label text shown on each segment; segment labels are only rendered when this is
   * a function. */
  showText?: ((...args: unknown[]) => unknown) | null
  /** Formats the tooltip text shown for each segment; the tooltip is only rendered when this is
   * a function. */
  showTooltip?: ((...args: unknown[]) => unknown) | null
  /** Font size in px for the tooltip text. */
  tooltipSize?: number
  /** Gap in px between adjacent segments within a row's bar. */
  padding?: number
}

/** Own `chart.brush.ratebar.setup()` fields - see legacy `ratebar.js`. */
export const RATE_BAR_BRUSH_OWN_DEFAULTS: RateBarBrushOptions = {
  activeIndex: null,
  activeTarget: null,
  activeEvent: null,
  showText: null,
  showTooltip: null,
  tooltipSize: 14,
  padding: 0,
}

export class RateBarBrush extends CoreBrush {
  protected barList: any[] = []

  getBarStyle(): RateBarStyle {
    return {
      fontColor: this.chart.theme('rateBarFontColor'),
      fontSize: this.chart.theme('rateBarFontSize'),
      borderColor: this.chart.theme('rateBarBorderColor'),
      borderWidth: this.chart.theme('rateBarBorderWidth'),
      borderRadius: this.chart.theme('rateBarBorderRadius') as number,
      disableOpacity: this.chart.theme('rateBarDisableBackgroundOpacity'),
      tooltipFontColor: this.chart.theme('rateBarTooltipFontColor'),
      tooltipFontSize: this.chart.theme('rateBarTooltipFontSize'),
      tooltipBackgroundColor: this.chart.theme('rateBarTooltipBackgroundColor'),
      tooltipBorderColor: this.chart.theme('rateBarTooltipBorderColor'),
      disableBackgroundOpacity: this.chart.theme('rateBarDisableBackgroundOpacity'),
    }
  }

  createTextElement(width: number, height: number, text: unknown): any {
    const style = this.getBarStyle()

    return this.svg
      .text({
        'font-size': style.fontSize,
        'font-weight': 'bold',
        fill: style.fontColor,
        dx: width / 2,
        dy: height / 2 + (style.fontSize as number) / 3,
        'text-anchor': 'middle',
      })
      .text(text as string)
  }

  createTooltipElement(width: number, tooltip: unknown): any {
    const style = this.getBarStyle()
    const tooltipSize = (this.brush as Record<string, unknown>).tooltipSize as number
    const textSize = this.svg.getTextSize(tooltip as string)

    const t = this.svg.group()

    const l = this.svg.path({
      stroke: style.tooltipBorderColor,
      'stroke-dasharray': '2,2',
      fill: 'transparent',
    })
    l.MoveTo(1, tooltipSize)
    l.VLineTo(tooltipSize / 2)
    l.HLineTo(width - 1)
    l.VLineTo(tooltipSize)

    const r = this.svg.rect({
      fill: style.tooltipBackgroundColor,
      width: textSize.width,
      height: tooltipSize - 2,
      x: width / 2 - textSize.width / 2,
      y: 1,
    })

    const b = this.svg
      .text({
        'font-size': style.tooltipFontSize,
        fill: style.tooltipFontColor,
        x: width / 2,
        y: tooltipSize / 2,
        'text-anchor': 'middle',
        'alignment-baseline': 'middle',
      })
      .text(tooltip as string)

    t.append(l)
    t.append(r)
    t.append(b)
    t.translate(0, -tooltipSize)

    return t
  }

  createBarElement(dataIndex: number, target: string, width: number, height: number, leftRadius = 0, rightRadius = 0, text: unknown = '', tooltip: unknown = ''): any {
    const g = this.svg.group()
    const style = this.getBarStyle()
    const targetIndex = (this.brush.target ?? []).indexOf(target)
    const color = this.color(dataIndex, targetIndex)
    const activeEvent = (this.brush as Record<string, unknown>).activeEvent

    const r = this.svg.path({
      fill: color,
      stroke: style.borderColor,
      'stroke-width': style.borderWidth,
    })
    r.MoveTo(leftRadius, 0)
    r.LineTo(width - rightRadius, 0)
    r.Arc(rightRadius, rightRadius, 0, 0, 1, width, rightRadius)
    r.LineTo(width, height - rightRadius)
    r.Arc(rightRadius, rightRadius, 0, 0, 1, width - rightRadius, height)
    r.LineTo(leftRadius, height)
    r.Arc(leftRadius, leftRadius, 0, 0, 1, 0, height - leftRadius)
    r.LineTo(0, leftRadius)
    r.Arc(leftRadius, leftRadius, 0, 0, 1, leftRadius, 0)
    r.ClosePath()

    g.append(r)
    g.append(this.createTextElement(width, height, text))

    if (this.svg.getTextSize(tooltip as string).width < width) {
      g.append(this.createTooltipElement(width, tooltip))
    }

    this.addEvent(g, dataIndex, targetIndex)

    if (activeEvent != null) {
      const bar = g
      bar.on(activeEvent, () => {
        this.setActiveBarElement(dataIndex, target)
      })

      bar.attr({ cursor: 'pointer' })
    }

    return g
  }

  setActiveBarElement(activeIndex: number | null, activeTarget: string | null): void {
    const style = this.getBarStyle()

    this.barList.forEach((bar, index) => {
      for (const key in bar) {
        if (activeIndex != null && activeIndex == index && activeTarget != null && activeTarget != key) {
          bar[key].attr({ 'fill-opacity': style.disableBackgroundOpacity })
        } else {
          bar[key].attr({ 'fill-opacity': 1 })
        }
      }
    })
  }

  drawBefore = (): void => {
    this.barList = []
  }

  draw = (): any => {
    const style = this.getBarStyle()
    const keys = this.brush.target ?? []
    const tooltipSize = (this.brush as Record<string, unknown>).tooltipSize as number
    const padding = (this.brush as Record<string, unknown>).padding as number
    const g = this.chart.svg.group()
    const height = (this.axis.y as BrushAxisScale).rangeBand!() - tooltipSize - padding / 2

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const nonZeroKeys = keys.filter((k) => (row[k] as number) > 0)
      const sumValues = nonZeroKeys.reduce((acc, cur) => acc + (row[cur] as number), 0)
      let startX = 0
      const startY = this.offset('y', index) - height / 2 + tooltipSize / 2

      nonZeroKeys.forEach((key, j) => {
        const width = (this.axis.x as BrushAxisScale & { rate(value: number, max: number): number }).rate(row[key] as number, sumValues)
        const percent = Math.round(((row[key] as number) / sumValues) * (this.axis.x as BrushAxisScale & { max(): number }).max())

        const showText = (this.brush as Record<string, unknown>).showText
        const showTooltip = (this.brush as Record<string, unknown>).showTooltip

        const text = typeof showText === 'function' ? (showText as (...a: unknown[]) => unknown).call(this, row[key], percent, key) : `${percent}%`
        const tooltip = typeof showTooltip === 'function' ? (showTooltip as (...a: unknown[]) => unknown).call(this, row[key], percent, key) : row[key]

        const r = this.createBarElement(
          index,
          key,
          width,
          height,
          j == 0 || nonZeroKeys.length == 1 ? style.borderRadius : 0,
          j == nonZeroKeys.length - 1 || keys.length == 1 ? style.borderRadius : 0,
          text,
          tooltip,
        )

        r.translate(startX, startY)
        g.append(r)

        startX += width

        if (!this.barList[index]) this.barList[index] = {}
        this.barList[index][key] = r
      })
    })

    this.setActiveBarElement((this.brush as Record<string, unknown>).activeIndex as number | null, (this.brush as Record<string, unknown>).activeTarget as string | null)

    return g
  }

  static setup(): Record<string, unknown> {
    return RATE_BAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('ratebar', RateBarBrush)
