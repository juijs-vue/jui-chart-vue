// Port of legacy `src/widget/zoomscroll.js` ("chart.widget.zoomscroll", extend:
// "chart.widget.core") - extends `CoreWidget` directly. A "minimap" scrollbar: renders a small
// detached SNAPSHOT chart (a headless second `Builder` instance, defaulting to an `area` brush -
// see `createChartImage()` below) as a background `<image>`, overlaid with two draggable rounded
// end-caps (`l_rect`/`r_rect`, each with its own round pill-shaped drag handle) and a draggable
// center window (`c_rect`) - dragging any of the three calls `axis.zoom(start, end)` on every axis
// in the chart, same end effect as `scroll.ts`/`vscroll.ts`, just with a live data-shape preview.
//
// **`createChartImage()`'s `builder(null, {...})` - a real, confirmed-safe headless-render
// technique, not a `jui-graph-ts` gap**: the legacy call passes `null` as the root selector; tracing
// through `jui-core`'s own UI-object factory (`UIEvent.build()`, `src/base/event.js`) shows
// `$(selector || "<div />")` - i.e. a FALSY selector creates a fresh, never-appended `<div>`
// element via jQuery, not a literal `null` DOM reference (which `util/svg.js`'s own `SVG`
// constructor would otherwise crash on, calling `rootElem.appendChild(...)` unconditionally - real
// upstream behavior, confirmed by reading that file too). This port reproduces the SAME real
// mechanism directly: `document.createElement('div')` (never attached to `document.body`), passed
// as `Builder.mount()`'s root - `Builder`/`SVG` need no special "headless" mode of their own, since
// an unattached element is a perfectly ordinary `HTMLElement` as far as `appendChild()`/`toXML()`
// are concerned.
//
// **PRESERVED QUIRK**: `preventDragAction()` is CALLED with one argument (`tw`, the candidate drag
// width) at both its call sites, but its own signature takes ZERO parameters - the passed `tw` is
// entirely unused inside it (it recomputes its own comparison purely from `r_rect`'s LIVE
// translate-so-far and `l_rect`'s LIVE size, never touching its own argument at all). Reproduced as
// a real, if inert, extra call argument - same "already-100%-inert argument" category as several
// other widgets in this project, not corrected to a 0-arg call.
import { Builder, CoreWidget, registerWidget } from 'jui-graph-ts'
import { GRID_TYPES } from '../gridTypes'

/** Literal port of jui-core's real `_.extend(origin, add, skip=true)` semantics (confirmed by
 * reading `jui-core/src/base/base.js` directly, NOT the naive "later object wins" a plain spread
 * would give) - with `skip === true`, `add`'s own value for a key is only ever copied onto
 * `origin` when `origin[key]` is `undefined`; a key origin ALREADY defines (even to `false`/`null`)
 * is NEVER overwritten. `createChartImage()` below relies on this EXACT asymmetry:
 * `{hide:false, line:"solid", format: widget.format}` are the widget's own hardcoded overrides for
 * the snapshot chart's x-axis (real `hide`/`line`/`format` from the real chart's own x-axis config
 * are deliberately discarded), while every OTHER real x-axis field (`domain`/`min`/`max`/`step`/
 * `type`/etc, none of which `origin` predefines) passes through untouched. Shallow only - the
 * calls here never need the original's recursive nested-object merge branch, since real axis
 * configs are flat key/value pairs (arrays like `domain: [a,b]` are never treated as "recursive"
 * objects either, matching every other `typeCheck("object", ...)` reimplementation in this
 * project, which explicitly excludes arrays). */
function extendUndefinedOnly(origin: Record<string, unknown>, add: Record<string, unknown>): Record<string, unknown> {
  for (const key in add) {
    if (typeof origin[key] === 'undefined') {
      origin[key] = add[key]
    }
  }
  return origin
}

/** `chart.widget.zoomscroll`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface ZoomScrollWidgetOptions {
  /** Brush type used to render the headless snapshot preview chart (e.g. `'area'`, `'line'`). */
  symbol?: string
  /** Data key the snapshot chart's brush targets. */
  key?: string | null
  /** Color (theme palette index or a CSS color string) for the snapshot brush and the center
   * window's border. */
  color?: string | number
  /** Formats the snapshot chart's x-axis tick labels. */
  format?: ((...args: unknown[]) => unknown) | null
  /** Which axis this minimap reflects/controls. */
  axis?: number
  /** Extra x offset in px, applied after position calculation. */
  dx?: number
  /** Extra y offset in px, applied after position calculation. */
  dy?: number
}

/** Own `chart.widget.zoomscroll.setup()` fields - see legacy `zoomscroll.js`. */
export const ZOOMSCROLL_WIDGET_OWN_DEFAULTS: ZoomScrollWidgetOptions = {
  symbol: 'area',
  key: null,
  color: 0,
  format: null,
  axis: 0,
  dx: 0,
  dy: 0,
}

export class ZoomScrollWidget extends CoreWidget {
  private zsAxis: any = null

  private w = 0
  private h = 0
  private b = 0
  private size = 0
  private radius = 0
  private tick = 0
  private start = 0
  private end = 0
  private count = 0

  private l_rect: any = null
  private l_ctrl: any = null
  private r_rect: any = null
  private r_ctrl: any = null
  private c_rect: any = null

  private setDragEvent(bg: any, ctrl: any, isLeft?: boolean): void {
    let isMove = false
    let isCenter = false
    let mouseStart = 0
    let centerStart = 0
    let bgWidth = 0

    const preventDragAction = (): boolean => {
      const t = this.r_rect.data('translate') as string
      const l = this.l_rect.size().width
      const r = parseInt(t.split(',')[0], 10)
      const max = r - this.tick / 2

      if (l < max) {
        return true
      }

      return false
    }

    const dragZoomAction = (e: { clientX: number }) => {
      if (!isMove) return
      const dis = e.clientX - mouseStart

      if (isCenter) {
        const tw = centerStart + dis
        const rw = tw + bgWidth
        const val = Math.floor(tw / this.tick) - this.start

        if (tw > 0 && tw + bgWidth < this.w) {
          this.l_rect.round(tw, this.h, this.radius, 0, 0, this.radius)
          this.l_ctrl.attr({ x: tw - this.size / 2 })
          this.r_rect.round(this.w - rw, this.h, 0, this.radius, this.radius, 0)
          this.r_rect.translate(rw, 0)
          this.r_ctrl.attr({ x: rw - this.size / 2 })
          this.c_rect.translate(tw, 0)

          this.start += val
          this.end += val
        }
      } else {
        if (isLeft) {
          const tw = bgWidth + dis

          if (tw < 0) return
          if (!preventDragAction() && dis > 0) return

          bg.round(tw, this.h, this.radius, 0, 0, this.radius)
          ctrl.attr({ x: tw - this.size / 2 })

          this.c_rect.attr({ width: this.w - this.l_rect.size().width - this.r_rect.size().width })
          this.c_rect.translate(tw, 0)

          this.start = Math.floor(tw / this.tick)
        } else {
          const tw = bgWidth - dis

          if (tw < 0) return
          if (!preventDragAction() && dis < 0) return

          bg.round(tw, this.h, 0, this.radius, this.radius, 0)
          bg.translate(this.w - tw, 0)
          ctrl.attr({ x: this.w - tw - this.size / 2 })

          this.c_rect.attr({ width: this.w - this.l_rect.size().width - this.r_rect.size().width })

          this.end = this.count - Math.floor(tw / this.tick)
        }
      }
    }

    const endZoomAction = () => {
      if (!isMove) return

      isMove = false
      const axes = this.chart.axis()

      this.chart.emit('zoomscroll.dragend', [this.start, this.end - 1])

      for (let i = 0; i < axes.length; i++) {
        axes[i].zoom(this.start, this.end)
      }

      if (!this.chart.isRender()) {
        this.chart.render()
      }

      this.chart.emit('zoomscroll.render', [this.start, this.end - 1])
    }

    ctrl.on('mousedown', (e: { clientX: number }) => {
      if (isMove) return

      isCenter = bg == null
      isMove = true

      if (isCenter) {
        bgWidth = ctrl.size().width
        centerStart = this.l_rect.size().width
        mouseStart = e.clientX
      } else {
        bgWidth = bg.size().width
        mouseStart = e.clientX
      }

      this.chart.emit('zoomscroll.dragstart')
    })

    this.on('chart.mousemove', dragZoomAction)
    this.on('bg.mousemove', dragZoomAction)
    this.on('chart.mouseup', endZoomAction)
    this.on('bg.mouseup', endZoomAction)
  }

  private createChartImage(): string {
    const widget = this.widget as Record<string, unknown>
    const size = this.chart.theme('zoomScrollGridFontSize') as number

    // See this file's own header comment: a real, confirmed-safe headless-render technique - a
    // never-attached `<div>`, matching the real engine's own `$(selector || "<div />")` fallback.
    const detachedRoot = document.createElement('div')
    const image = new Builder()
    Object.assign(image, { gridTypes: GRID_TYPES })
    image.mount(detachedRoot, {
      width: this.w,
      height: this.h,
      padding: {
        top: 0,
        left: 0,
        right: 0,
        bottom: size + 8,
      },
      axis: [
        {
          x: extendUndefinedOnly({ hide: false, line: 'solid', format: widget.format }, this.zsAxis.get('x') as Record<string, unknown>),
          y: extendUndefinedOnly({ hide: true, line: false }, this.zsAxis.get('y') as Record<string, unknown>),
          data: this.zsAxis.origin,
        },
      ],
      brush: [
        {
          type: widget.symbol as string,
          target: [widget.key],
          colors: [widget.color],
        },
      ],
      style: {
        backgroundColor: 'transparent',
        gridXFontSize: size,
        gridTickPadding: this.chart.theme('zoomScrollGridTickPadding'),
        areaBackgroundOpacity: this.chart.theme('zoomScrollBrushAreaBackgroundOpacity'),
        lineBorderWidth: this.chart.theme('zoomScrollBrushLineBorderWidth'),
      },
    } as never)

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(image.svg.toXML())
  }

  drawBefore = (): void => {
    const widget = this.widget as Record<string, unknown>
    this.zsAxis = this.chart.axis(widget.axis as number)
    this.count = this.zsAxis.origin.length
    this.start = this.zsAxis.start
    this.end = this.zsAxis.end
    this.b = this.chart.theme('zoomScrollAreaBorderWidth') as number
    this.w = this.chart.area('width') - this.b * 2
    this.h = (this.chart.theme('zoomScrollBackgroundSize') as number) - this.b * 2
    this.size = this.chart.theme('zoomScrollButtonSize') as number
    this.radius = this.chart.theme('zoomScrollAreaBorderRadius') as number
    this.tick = this.w / this.count
  }

  draw = (): any => {
    const widget = this.widget as Record<string, unknown>
    const areaStyle = {
      fill: this.chart.theme('zoomScrollAreaBackgroundColor'),
      'fill-opacity': this.chart.theme('zoomScrollAreaBackgroundOpacity'),
      stroke: this.chart.theme('zoomScrollAreaBorderColor'),
      'stroke-width': this.b,
    }

    return this.svg
      .group({}, () => {
        const lw = this.start * this.tick
        const rw = (this.count - this.end) * this.tick

        if (isNaN(lw) || isNaN(rw)) {
          return
        }

        this.svg.image({
          width: this.w,
          height: this.h,
          'xlink:href': this.createChartImage(),
        })

        this.l_rect = this.svg.pathRect(areaStyle)
        this.l_rect.round(lw, this.h, this.radius, 0, 0, this.radius)

        this.r_rect = this.svg.pathRect(areaStyle)
        this.r_rect.round(rw, this.h, 0, this.radius, this.radius, 0)
        this.r_rect.translate(this.w - rw, 0)

        this.c_rect = this.svg
          .rect({
            width: this.w - lw - rw,
            height: this.h,
            fill: 'transparent',
            'fill-opacity': 0,
            stroke: this.chart.color(widget.color as string | number),
            'stroke-width': this.b,
            cursor: 'move',
          })
          .translate(lw, 0)

        this.l_ctrl = this.svg.rect({
          x: lw - this.size / 2,
          y: this.h / 2 - this.size / 2,
          width: this.size,
          height: this.size,
          fill: '#e0e0e0',
          cursor: 'e-resize',
          rx: this.size / 2,
          'stroke-linecap': 'round',
          stroke: '#616161',
        })
        this.r_ctrl = this.svg.rect({
          x: this.w - rw - this.size / 2,
          y: this.h / 2 - this.size / 2,
          width: this.size,
          height: this.size,
          fill: '#e0e0e0',
          cursor: 'e-resize',
          rx: this.size / 2,
          'stroke-linecap': 'round',
          stroke: '#616161',
        })

        this.setDragEvent(this.l_rect, this.l_ctrl, true)
        this.setDragEvent(this.r_rect, this.r_ctrl, false)
        this.setDragEvent(null, this.c_rect)
      })
      .translate((widget.dx as number) + this.chart.area('x'), (widget.dy as number) + this.chart.area('y2') - this.b)
  }

  static setup(): Record<string, unknown> {
    return ZOOMSCROLL_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('zoomscroll', ZoomScrollWidget)
