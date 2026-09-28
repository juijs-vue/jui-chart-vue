// Port of legacy `src/widget/tooltip.js` ("chart.widget.tooltip", extend: "chart.widget.core").
import { CoreWidget, registerWidget } from 'jui-graph-ts'
import { colorUtil } from 'jui-graph-ts'

const PADDING = 7
const ANCHOR = 7
const RATIO = 1.2

/** `chart.widget.tooltip`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface TooltipWidgetOptions {
  /** Which side of the cursor the balloon appears on (auto-flips per-side when `flip` is set and
   * it would overflow the axis area). */
  orient?: 'top' | 'bottom' | 'left' | 'right'
  /** Draws the balloon's pointer triangle when true; a plain rectangle when false. */
  anchor?: boolean
  /** Shows every target's value in one tooltip instead of just the hovered data key's row. */
  all?: boolean
  /** Draws a guide line from the axis edge to the cursor alongside the balloon. */
  line?: boolean
  /** Flips the balloon to the opposite side when it would otherwise overflow the axis area. */
  flip?: boolean
  /** Formats the `{key, value}` (or bare value, when no key applies) shown per row; the raw
   * value/key are used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
  /** Which brush(es) this tooltip listens to `mouseover`/`mousemove`/`mouseout` on - a single
   * index or an array of indexes. */
  brush?: number | number[]
}

/** Own `chart.widget.tooltip.setup()` fields - see legacy `tooltip.js`. */
export const TOOLTIP_WIDGET_OWN_DEFAULTS: TooltipWidgetOptions = {
  orient: 'top',
  anchor: true,
  all: false,
  line: false,
  flip: false,
  format: null,
  brush: 0,
}

export class TooltipWidget extends CoreWidget {
  // `this.chart` is already typed as `WidgetChart` by `CoreWidget` itself (`widget/core.ts`).
  private tooltips: Record<number, any> = {}
  private lineHeight = 0

  private getFormat(k: string | null, d: Record<string, unknown> | null): { key: string | null; value: unknown } {
    let key: string | null = null
    let value: unknown = null
    const widget = this.widget as Record<string, unknown>

    if (typeof widget.format === 'function') {
      const obj = this.format(d, k)

      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        key = (obj as Record<string, unknown>).key as string | null
        value = (obj as Record<string, unknown>).value
      } else {
        value = obj
      }
    } else {
      if (k && !d) {
        value = k
      }

      if (k && d) {
        key = k
        value = this.format(d[k])
      }
    }

    return { key, value }
  }

  private printTooltip(obj: { brush: any; dataKey?: string | null; data?: Record<string, unknown> | null }): { width: number; height: number; onlyValue: boolean } {
    const tooltip = this.tooltips[obj.brush.index]
    const texts = tooltip.get(1).get(1)
    let width = 0
    let height = 0
    let onlyValue = false
    const widget = this.widget as Record<string, unknown>

    const setTextInTooltip = (targets: string[]): void => {
      for (let i = 0; i < targets.length; i++) {
        const key = targets[i]
        const msg = this.getFormat(key, obj.data ?? null)

        texts.get(i).attr({ x: PADDING })

        if (msg.key) {
          texts.get(i).get(0).text(msg.key)
        } else {
          texts.get(i).get(1).attr({ 'text-anchor': 'middle' })
          onlyValue = true
        }

        if (msg.value !== null && msg.value !== undefined) {
          texts.get(i).get(1).attr({ x: 0 }).text(msg.value)
        }

        width = Math.max(width, texts.get(i).size().width)
      }

      height = targets.length * this.lineHeight
    }

    if (obj.dataKey && widget.all === false) {
      setTextInTooltip([obj.dataKey])
    } else {
      setTextInTooltip(obj.brush.target)
    }

    return {
      width: width + PADDING * 3,
      height: height + PADDING,
      onlyValue,
    }
  }

  private existBrush(index: number): boolean {
    const list = this.getIndexArray((this.widget as Record<string, unknown>).brush)
    return list.includes(index)
  }

  private getColorByKey(obj: { brush: any; dataKey?: string | null }): string | null {
    const targets: string[] = obj.brush.target

    for (let i = 0; i < targets.length; i++) {
      if (targets[i] == obj.dataKey) {
        // Legacy calls `ColorUtil.lighten(color)` with no explicit rate - `jui-graph-ts`'s
        // `colorUtil.lighten()` now has its `rate = 0` default back (fixed upstream), matching
        // this call 1:1.
        return colorUtil.lighten(this.chart.color(i, obj.brush.colors))
      }
    }

    return null
  }

  private getTooltipXY(e: any, size: { width: number; height: number }, orient: string | null): { x: number; y: number; c: number } {
    let x = e.bgX - size.width / 2
    let y = e.bgY - size.height - ANCHOR - PADDING / 2
    let lineX = 2

    if (orient == 'left' || orient == 'right') {
      y = e.bgY - size.height / 2 - PADDING / 2
    }

    if (orient == 'left') {
      x = e.bgX - size.width - ANCHOR
    } else if (orient == 'right') {
      x = e.bgX + ANCHOR
      lineX = -2
    } else if (orient == 'bottom') {
      y = e.bgY + ANCHOR * 2
    }

    return { x, y, c: lineX }
  }

  private setTooltipEvent(): void {
    let isActive = false
    let size: { width: number; height: number; onlyValue: boolean } | null = null
    let orient: string | null = null
    let axis: any = null
    const widget = this.widget as Record<string, unknown>

    this.on(
      'mouseover',
      (obj: any, e: any) => {
        if (isActive || !this.existBrush(obj.brush.index)) return
        if (!obj.dataKey && !obj.data) return

        size = this.printTooltip(obj)
        orient = widget.orient as string
        axis = this.chart.axis(obj.brush.axis)

        const xy = this.getTooltipXY(e, size, orient)
        const x = xy.x - this.chart.padding('left')
        const y = xy.y - this.chart.padding('top')

        if (widget.flip) {
          if (orient == 'left' && x < 0) {
            orient = 'right'
          } else if (orient == 'right' && x + size.width > axis.area('width')) {
            orient = 'left'
          } else if (orient == 'top' && y < 0) {
            orient = 'bottom'
          } else if (orient == 'bottom' && y + size.height > axis.area('height')) {
            orient = 'top'
          }
        }

        const tooltip = this.tooltips[obj.brush.index]
        const line = tooltip.get(0)
        const target = tooltip.get(1)
        const rect = tooltip.get(1).get(0)
        const text = tooltip
          .get(1)
          .get(1)
          .translate(0, orient != 'bottom' ? this.lineHeight : this.lineHeight + ANCHOR)
        const borderColor = this.chart.theme('tooltipBorderColor') || this.getColorByKey(obj)
        const lineColor = this.chart.theme('tooltipLineColor') || this.getColorByKey(obj)

        rect.attr({
          points: this.balloonPoints(orient!, size.width, size.height, widget.anchor ? ANCHOR : (null as unknown as number)),
          stroke: borderColor,
        })
        line.attr({ stroke: lineColor })
        text.each((_i: number, elem: any) => {
          elem.get(1).attr({ x: size!.onlyValue ? size!.width / 2 : size!.width - PADDING })
        })
        tooltip.attr({ visibility: 'visible' })
        target.translate(xy.x, xy.y)

        isActive = true
      },
      undefined,
    )

    this.on(
      'mousemove',
      (obj: any, e: any) => {
        if (!isActive) return

        const tooltip = this.tooltips[obj.brush.index]
        const line = tooltip.get(0)
        const target = tooltip.get(1)
        const xy = this.getTooltipXY(e, size!, orient)

        line.attr({
          x1: e.bgX + xy.c,
          y1: this.chart.padding('top') + axis.area('y'),
          x2: e.bgX + xy.c,
          y2: this.chart.padding('top') + axis.area('y2'),
        })

        target.translate(xy.x, xy.y)
      },
      undefined,
    )

    this.on(
      'mouseout',
      (obj: any) => {
        if (!isActive) return

        const tooltip = this.tooltips[obj.brush.index]
        tooltip.attr({ visibility: 'hidden' })

        isActive = false
      },
      undefined,
    )
  }

  drawBefore = (): void => {
    this.lineHeight = (this.chart.theme('tooltipFontSize') as number) * RATIO
  }

  draw = (): any => {
    const chart = this.chart
    const widget = this.widget as Record<string, unknown>
    const group = chart.svg.group()
    const list = this.getIndexArray(widget.brush)

    for (let i = 0; i < list.length; i++) {
      const brush = (chart as unknown as { get(type: string, key: number): any }).get('brush', list[i])
      const words = ['']

      if (widget.all && brush.target.length > 1) {
        for (let j = 1; j < brush.target.length; j++) {
          words.push('')
        }
      }

      this.tooltips[brush.index] = chart.svg.group({ visibility: 'hidden' }, function (this: any) {
        chart.svg.line({
          'stroke-width': chart.theme('tooltipLineWidth'),
          visibility: widget.line ? 'visible' : 'hidden',
        })

        chart.svg.group({}, function (this: any) {
          chart.svg.polygon({
            fill: chart.theme('tooltipBackgroundColor'),
            'fill-opacity': chart.theme('tooltipBackgroundOpacity'),
            'stroke-width': chart.theme('tooltipBorderWidth'),
          })

          const text = (chart as unknown as { texts(attr: Record<string, unknown>, words: string[], ratio: number): any }).texts(
            {
              'font-size': chart.theme('tooltipFontSize'),
              fill: chart.theme('tooltipFontColor'),
            },
            words,
            RATIO,
          )

          for (let k = 0; k < words.length; k++) {
            text.get(k).append((chart.svg as unknown as { tspan(attr: Record<string, unknown>): any }).tspan({ 'text-anchor': 'start', 'font-weight': 'bold', x: PADDING }))
            text.get(k).append((chart.svg as unknown as { tspan(attr: Record<string, unknown>): any }).tspan({ 'text-anchor': 'end' }))
          }
        })
      })

      group.append(this.tooltips[brush.index])
    }

    this.setTooltipEvent()

    return group
  }

  static setup(): Record<string, unknown> {
    return TOOLTIP_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('tooltip', TooltipWidget)
