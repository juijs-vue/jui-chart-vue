// Port of legacy `src/widget/guideline.js` ("chart.widget.guideline", extend: "chart.widget.core")
// - extends `CoreWidget` directly. A vertical "scrubber" guide line for a date/range x-axis: on
// `axis.mousemove`, inverts the cursor's x position to a time value, snaps it to the nearest data
// row (`Math.floor((time - domain[0]) / interval)`), and shows a line + optional x-axis balloon
// tooltip (`xFormat`) plus a per-target content tooltip (point markers + a legend-aware key/value
// table, `tooltipFormat`) at that row - all driven through a small custom event bus
// (`guideline.show`/`guideline.hide`/`guideline.active`) rather than direct method calls, so OTHER
// widgets/code can also trigger it (`chart.emit("guideline.show", time)`).
//
// **Legend-integration quirk, literal**: `drawContentTooltip()` reads `chart.getCache("legend_target",
// brush.target)` - the SAME cache key `legend.ts`'s `LegendWidget` writes via `setCache(...)` when a
// legend entry is toggled off/on (confirmed by reading `legend.ts` directly - see its own
// `setCache('legend_target', target)` call). A target NOT in that cached list gets its tooltip
// row/point hidden (`fill: 'transparent'`) here - i.e. `guideline`'s own tooltip content
// automatically respects whatever `legend` widget last toggled, with no direct coupling between the
// two files beyond this shared cache key.
//
// **`getTextWidth()` uses a `<canvas>` 2D context's `measureText()`, NOT `chart.svg.getTextSize()`**
// (the technique `title.ts` uses) - a real, literal difference in the original source (confirmed by
// reading `guideline.js` in full: it defines its own canvas-based helper, memoized onto the
// function object itself via `getTextWidth.canvas ||= ...`, exactly as ported below) - kept
// faithful rather than "fixed" to reuse the SVG-based technique. **Test-environment note**: jsdom
// (this project's unit-test environment) has no real `<canvas>` 2D context implementation
// (`getContext('2d')` returns `null`, logging "Not implemented..." - visible in every test run's
// console output already), so this method throws if actually invoked outside a real browser; this
// is a genuine environment limitation of jsdom, not a bug in this port, and is only reachable when
// `widget.tooltipFormat` is configured (see `drawContentTooltip()` below) - this project's own
// tests for this widget deliberately avoid configuring `tooltipFormat` for that reason (Playwright,
// which runs in a real headless Chromium, is this widget's real verification for that code path).
import { CoreWidget, registerWidget } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

const TW = 50
const TH = 18
const TA = TW / 10
const CP = 5
const LRP = 5

/** Own `chart.widget.guideline.setup()` fields - see legacy `guideline.js`. **PRESERVED QUIRK**:
 * unlike `cross.js` (which declares its own `axis: 0` default), `guideline.js`'s `setup()` has NO
 * `axis` field at all, even though `draw()` reads `widget.axis` for its `this.on("axis.mouseout",
 * ..., widget.axis)`/`"axis.mousemove"` calls - so `widget.axis` is `undefined` unless a caller
 * explicitly configures one. `CoreWidget.on()`'s own per-axis dispatch guard
 * (`typeCheck("integer", axisIndex)`) simply skips axis-scoping entirely when its `axisIndex` isn't
 * an integer - so by default, this widget's mouseout/mousemove handlers fire for EVERY axis in the
 * chart, not just one. Confirmed by reading the real source, not assumed; not "fixed" by inventing
 * a default here. */
export interface GuidelineWidgetOptions {
  /** Index into `chart.get("brush", ...)` - which brush's axis/target list this guide line reads
   * (its own axis lookup, `axis.mousemove` targeting, and point markers all derive from this
   * brush's config, not from a directly-configured `axis`). */
  brush?: number
  /** Formats the time value shown in the x-axis balloon tooltip; the balloon itself only renders
   * when this is a function. */
  xFormat?: ((this: unknown, value: unknown) => unknown) | null
  /** Formats each target's `{key, value}` row in the content tooltip table; rows only populate
   * when this is a function. */
  tooltipFormat?: ((this: unknown, data: unknown, key: string) => { key: unknown; value: unknown }) | null
  /** When true, point markers/tooltip values accumulate across targets (stacked-series reading)
   * instead of each showing its own raw value. */
  stackPoint?: boolean
}

export const GUIDELINE_WIDGET_OWN_DEFAULTS: GuidelineWidgetOptions = {
  brush: 0,
  xFormat: null,
  tooltipFormat: null,
  stackPoint: false,
}

let sharedCanvas: HTMLCanvasElement | null = null

/** Literal port of legacy `getTextWidth(text, font)` - see this file's own header comment on the
 * real canvas dependency and its jsdom test-environment limitation. */
function getTextWidth(text: string, font: string): number {
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas')
  const context = sharedCanvas.getContext('2d') as CanvasRenderingContext2D
  context.font = font
  const metrics = context.measureText(text)
  return metrics.width * 1.5
}

export class GuideLineWidget extends CoreWidget {
  private brushCfg: Record<string, unknown> = {}
  private guideAxis: any = null
  private pl = 0
  private pt = 0
  private g: any = null
  private line: any = null
  private xTooltip: any = null
  private contentTooltip: any = null
  private points: Record<string, any> = {}
  private tspan: any[] = []

  private printXAxisTooltip(index: number, text: any, message: unknown): void {
    if (!this.tspan[index]) {
      const elem = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      text.element.appendChild(elem)
      this.tspan[index] = elem
    }

    this.tspan[index].textContent = message
  }

  drawBefore = (): void => {
    const widget = this.widget as Record<string, unknown>
    this.brushCfg = this.chart.get('brush', widget.brush)
    const axis = (this.guideAxis = this.chart.axis(this.brushCfg.axis as number))

    this.pl = this.chart.padding('left')
    this.pt = this.chart.padding('top')

    this.g = this.chart.svg
      .group({ visibility: 'hidden' }, () => {
        if (typeof widget.xFormat === 'function') {
          this.xTooltip = this.chart.svg
            .group({}, () => {
              this.chart.svg.polygon({
                fill: this.chart.theme('guidelineBalloonBackgroundColor'),
                'fill-opacity': this.chart.theme('guidelineBalloonBackgroundOpacity'),
                points: this.balloonPoints('bottom', TW, TH, TA),
              })

              this.chart.text({
                'font-size': this.chart.theme('guidelineBalloonFontSize'),
                fill: this.chart.theme('guidelineBalloonFontColor'),
                'text-anchor': 'middle',
                x: TW / 2,
                y: 17,
              })
            })
            .translate(0, axis.area('height') + TA)
        }

        this.line = this.chart.svg.line({
          x1: 0,
          y1: 0,
          x2: 0,
          y2: axis.area('height'),
          stroke: this.chart.theme('guidelineBorderColor'),
          'stroke-width': this.chart.theme('guidelineBorderWidth'),
          'stroke-dasharray': this.chart.theme('guidelineBorderDashArray'),
          opacity: this.chart.theme('guidelineBorderOpacity'),
        })

        const targets = this.brushCfg.target as string[]
        targets.forEach((target, index) => {
          this.points[target] = this.chart.svg.circle({
            fill: this.chart.color(index),
            stroke: this.chart.theme('guidelinePointBorderColor'),
            'stroke-width': this.chart.theme('guidelinePointBorderWidth'),
            r: this.chart.theme('guidelinePointRadius'),
          })
        })

        this.contentTooltip = this.chart.svg.group({}, () => {
          this.chart.svg.rect({
            fill: this.chart.theme('guidelineTooltipBackgroundColor'),
            'fill-opacity': this.chart.theme('guidelineTooltipBackgroundOpacity'),
            stroke: this.chart.theme('guidelineTooltipBorderColor'),
            'stroke-width': this.chart.theme('guidelineTooltipBorderWidth'),
          })

          this.chart.svg
            .group({}, () => {
              targets.forEach(() => {
                const text = this.chart.svg.text({
                  'font-size': this.chart.theme('guidelineTooltipFontSize'),
                })

                text.append(this.chart.svg.tspan({ 'text-anchor': 'start', 'font-weight': 'bold', x: CP * 1.5 }))
                text.append(this.chart.svg.tspan({ 'text-anchor': 'end' }))
              })
            })
            .translate(CP, CP)

          this.chart.svg
            .group({}, () => {
              targets.forEach(() => {
                this.chart.svg.circle({ r: this.chart.theme('guidelineTooltipPointRadius') })
              })
            })
            .translate(CP * 1.5, 0)
        })
      })
      .translate(this.pl, this.pt)
  }

  drawGuildLine(left: number, value: unknown): void {
    const widget = this.widget as Record<string, unknown>

    if (this.line) {
      this.line.attr({ x1: left, x2: left })
    }

    if (this.xTooltip) {
      this.xTooltip.translate(left - TW / 2, this.guideAxis.area('height') + TA)
      const message = (widget.xFormat as (this: unknown, value: unknown) => unknown).call(this.chart, value)
      this.printXAxisTooltip(1, this.xTooltip.get(1), message)
    }
  }

  drawContentTooltip(left: number, data: BrushData | null): void {
    const widget = this.widget as Record<string, unknown>
    if (this.contentTooltip == null || data == null) return

    const cacheTargets = this.chart.getCache('legend_target', this.brushCfg.target) as string[]
    const rect = this.contentTooltip.children[0]
    const texts = this.contentTooltip.children[1]
    let width = 0
    const height = (this.chart.theme('guidelineTooltipFontSize') as number) * 1.2 * (cacheTargets.length + 1)
    let current = 0

    const targets = this.brushCfg.target as string[]

    targets.forEach((target, index) => {
      const targetIndex = cacheTargets.indexOf(target)
      const text = this.contentTooltip.get(1).get(index)
      const point = this.contentTooltip.get(2).get(index)

      if (targetIndex !== -1) {
        const y = (this.chart.theme('guidelineTooltipFontSize') as number) * 1.2 * (targetIndex + 1)
        text.attr({ fill: this.chart.theme('guidelineTooltipFontColor'), y })
        point.attr({ fill: this.chart.color(index), cy: y })
        this.points[target].attr({ fill: this.chart.color(index) })

        current = widget.stackPoint ? current + (data[target] as number) : (data[target] as number)
        this.points[target].translate(left, this.guideAxis.y(current))
      } else {
        text.attr({ fill: 'transparent' })
        point.attr({ fill: 'transparent' })
        this.points[target].attr({ fill: 'transparent' })
      }
    })

    targets.forEach((key, index) => {
      if (typeof widget.tooltipFormat === 'function') {
        const ret = (widget.tooltipFormat as (this: unknown, data: unknown, key: string) => { key: unknown; value: unknown }).apply(this, [data, key])

        width = Math.max(width, getTextWidth(`${ret.key} ${ret.value}`, `bold ${this.chart.theme('guidelineTooltipFontSize')}px ${this.chart.theme('fontFamily')}`))

        texts.get(index).get(0).text(ret.key)
        texts.get(index).get(1).text(ret.value)
      }
    })

    rect.attr({ width: width + CP, height })

    for (let i = 0; i < texts.children.length; i++) {
      texts.children[i].get(1).attr({ x: width - CP })
    }

    this.contentTooltip.translate(left + width > this.guideAxis.area('width') ? left - width - CP - LRP : left + LRP, this.guideAxis.area('height') / 2 - height / 2)
  }

  draw = (): any => {
    const widget = this.widget as Record<string, unknown>

    this.chart.on('guideline.show', (time: unknown) => {
      if (this.guideAxis.data.length === 0) return

      this.g.attr({ visibility: 'visible' })

      const domain = (this.guideAxis.get('x') as Record<string, unknown>).domain as unknown[]
      const range = +(domain[1] as number) - +(domain[0] as number)
      const interval = range / this.guideAxis.data.length
      const index = Math.floor((+(time as number) - +(domain[0] as number)) / interval)
      const left = this.guideAxis.x(index)

      this.drawGuildLine(left, time)
      this.drawContentTooltip(left, this.guideAxis.data[index] ?? null)
      this.chart.setCache('guideline_time', time)
    })

    this.chart.on('guideline.hide', () => {
      if (this.guideAxis.data.length === 0) return

      this.g.attr({ visibility: 'hidden' })
      this.chart.setCache('guideline_time', null)
    })

    this.chart.on('render', () => {
      const time = this.chart.getCache('guideline_time', null)

      if (time != null) this.chart.emit('guideline.show', time)
    })

    this.on(
      'axis.mouseout',
      () => {
        this.chart.emit('guideline.hide')
        this.chart.emit('guideline.active')
      },
      widget.axis as number,
    )

    this.on(
      'axis.mousemove',
      (e: { chartX: number }) => {
        const time = this.guideAxis.x.invert(e.chartX)

        if (time !== this.chart.getCache('guideline_time', null)) {
          this.chart.emit('guideline.show', time)
          this.chart.emit('guideline.active', time)
        }
      },
      widget.axis as number,
    )

    return this.g
  }

  static setup(): Record<string, unknown> {
    return GUIDELINE_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('guideline', GuideLineWidget)
