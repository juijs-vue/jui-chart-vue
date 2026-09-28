// Port of legacy `src/widget/zoom.js` ("chart.widget.zoom", extend: "chart.widget.core") -
// extends `CoreWidget` directly. A REAL zoom (unlike the passive `zoomselect.ts`): drags a
// horizontal band over one or more configured axes and, on release, actually rewrites that axis's
// domain - `axis.zoom(start, end)` for a "block" x-axis, or `axis.updateGrid("x", {domain:
// [stime, etime], ...})` for a "date"/"dateblock" one (caching the PRE-zoom domain/interval/format
// per axis index, so `rollbackZoom()` can restore it later via the same "×" close-button click
// `zoomselect.ts` also has). `integrate: true` shares ONE drag gesture across every configured axis
// (only the first section wires real drag handlers; the rest render a static overlay only).
//
// **Genuinely shares almost all of its drag/update/rollback logic with `zoomselect.ts`** - same
// `setDragEvent`/`updateBlockGrid`/`updateDateObj`/`getAxisList` shape, confirmed by reading both
// files side by side - but both extend `chart.widget.core` DIRECTLY (no shared `extend:` chain
// between them in the original), so this is ported as its own independent class, not a subclass of
// `ZoomSelectWidget` - duplicating the small amount of overlapping logic rather than inventing an
// inheritance relationship the original source doesn't have.
import { CoreWidget, registerWidget } from 'jui-graph-ts'

const R = 12

/** `chart.widget.zoom`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface ZoomWidgetOptions {
  /** Which axis (or axes) to draw a drag-to-zoom band over - a single index or an array. */
  axis?: number | number[]
  /** When zooming multiple axes, share one drag gesture across all of them (only the first axis
   * gets real drag handlers; the rest render a static overlay that follows along). */
  integrate?: boolean
  /** Sets the tick interval of the rewritten date/dateblock-axis scale after a zoom - a fixed
   * number, or a function of the zoomed `(stime, etime)` range returning one. Only applies to
   * `"date"`/`"dateblock"` x-axes (a `"block"` axis zooms via `axis.zoom()` instead, which has no
   * interval concept). */
  interval?: number | ((this: unknown, stime: number, etime: number) => number) | null
  /** Formats the rewritten date-axis scale's tick labels after a zoom, as a function of the
   * zoomed `(stime, etime)` range. Same `"date"`/`"dateblock"`-only applicability as `interval`. */
  format?: ((this: unknown, stime: number, etime: number) => unknown) | null
}

/** Own `chart.widget.zoom.setup()` fields - see legacy `zoom.js`. */
export const ZOOM_WIDGET_OWN_DEFAULTS: ZoomWidgetOptions = {
  axis: 0,
  integrate: false,
  interval: null,
  format: null,
}

export class ZoomWidget extends CoreWidget {
  private top = 0
  private left = 0

  /** Wires the drag-to-zoom gesture for one axis. `thumb`/`bg` are `null` for a non-first axis
   * under `widget.integrate` (see `drawSection()`) - in that case this only tracks state, drawing
   * nothing of its own, since the first axis's own drag handlers drive the shared gesture. On
   * `axis.mouseup`/`chart.mouseup`/`bg.mouseup`, resolves the drag into a real domain rewrite: a
   * `"block"` x-axis calls `axis.zoom(start, end)` via `updateBlockGrid()`; a `"date"`/`"dateblock"`
   * one rewrites the x-grid's `domain`/`interval`/`format` via `updateDateObj()`, caching the
   * PRE-zoom domain/interval/format the first time a given axis is zoomed (`zoomDepth === 0`) so
   * `rollbackZoom()` can restore it; `"dateblock"` additionally re-applies `updateBlockGrid()` on
   * top. Always force-renders and emits `zoom.end` with whatever range was computed. */
  private setDragEvent(axisIndex: number, thumb: any, bg: any): void {
    const axis = this.chart.axis(axisIndex)
    const xtype = (axis.get('x') as Record<string, unknown>).type
    let startDate: Date | null = null
    let isMove = false
    let mouseStart = 0
    let thumbWidth = 0

    const updateBlockGrid = (): [number, number] | undefined => {
      const range = axis.end - axis.start
      const tick = axis.area('width') / (range > 0 ? range : axis.data.length)
      const x = (thumbWidth > 0 ? mouseStart : mouseStart + thumbWidth) - this.left
      const start = Math.floor(x / tick) + axis.start
      const end = Math.ceil((x + Math.abs(thumbWidth)) / tick) + axis.start

      if (start < end) {
        axis.zoom(start, end)
        return [start, end]
      }
    }

    const updateDateObj = (endDate: Date): [number, number] | undefined => {
      const stime = (startDate as Date).getTime()
      const etime = endDate.getTime()

      if (stime >= etime) return

      const widget = this.widget as Record<string, unknown>
      let interval = widget.interval
      let format = widget.format

      if (typeof interval === 'function') {
        interval = (interval as (this: unknown, stime: number, etime: number) => number).apply(this.chart, [stime, etime])
      }

      if (typeof format === 'function') {
        format = (format as (this: unknown, stime: number, etime: number) => unknown).apply(this.chart, [stime, etime])
      }

      const zoomDepth = this.chart.getCache(`zoomDepth_${axisIndex}`, 0) as number
      if (zoomDepth === 0) {
        this.chart.setCache(`prevDomain_${axisIndex}`, (axis.get('x') as Record<string, unknown>).domain)
        this.chart.setCache(`prevInterval_${axisIndex}`, (axis.get('x') as Record<string, unknown>).interval)
        this.chart.setCache(`prevFormat_${axisIndex}`, (axis.get('x') as Record<string, unknown>).format)
      }
      this.chart.setCache(`zoomDepth_${axisIndex}`, zoomDepth + 1)

      axis.updateGrid('x', {
        domain: [stime, etime],
        interval: interval != null ? interval : (axis.get('x') as Record<string, unknown>).interval,
        format: format != null ? format : (axis.get('x') as Record<string, unknown>).format,
      })

      return [stime, etime]
    }

    const renderChart = () => {
      if (bg != null) {
        bg.attr({ visibility: 'visible' })
      }

      if (!this.chart.isRender()) {
        this.chart.render()
      }
    }

    const resetDragStatus = () => {
      isMove = false
      mouseStart = 0
      thumbWidth = 0
      startDate = null

      if (thumb != null) {
        thumb.attr({ width: 0 })
      }
    }

    const endZoomAction = (e: { chartX: number }) => {
      let args: number[] | undefined = []

      isMove = false
      if (thumbWidth === 0) return

      if (xtype === 'block') {
        args = updateBlockGrid()
      } else {
        if (startDate != null) {
          args = updateDateObj(axis.x.invert(e.chartX))

          if (xtype === 'dateblock') {
            args = (args ?? []).concat(updateBlockGrid() ?? [])
          }
        }
      }

      renderChart()
      resetDragStatus()

      this.chart.emit('zoom.end', args)
    }

    this.on(
      'axis.mousedown',
      (e: { bgX: number; chartX: number }) => {
        if (isMove) return

        isMove = true
        mouseStart = e.bgX

        if (xtype === 'date' || xtype === 'dateblock') {
          startDate = axis.x.invert(e.chartX)
        }

        this.chart.emit('zoom.start')
      },
      axisIndex,
    )

    this.on(
      'axis.mousemove',
      (e: { bgX: number }) => {
        if (!isMove) return

        thumbWidth = e.bgX - mouseStart

        if (thumb != null) {
          if (thumbWidth > 0) {
            thumb.attr({ width: thumbWidth })
            thumb.translate(mouseStart, this.top + axis.area('y'))
          } else {
            thumb.attr({ width: Math.abs(thumbWidth) })
            thumb.translate(mouseStart + thumbWidth, this.top + axis.area('y'))
          }
        }
      },
      axisIndex,
    )

    this.on('axis.mouseup', endZoomAction, axisIndex)
    this.on('chart.mouseup', endZoomAction)
    this.on('bg.mouseup', endZoomAction)
    this.on('bg.mouseout', endZoomAction)
  }

  /** Draws one axis's zoom overlay: a semi-transparent drag-band `thumb` plus a hidden "×"
   * close-button group (`bg`) that appears after a zoom and, on click, calls `rollbackZoom()` -
   * for every configured axis when `widget.integrate` is set (restoring all of them together),
   * or just this `axisIndex` otherwise. Real drag handlers are only wired
   * (`setDragEvent(axisIndex, thumb, bg)`) for the first axis when `widget.integrate` is true
   * (`axisSeq === 0`); every other integrated axis gets `setDragEvent(axisIndex, null, null)` -
   * state tracking only, per this file's header comment on `integrate` sharing one gesture. */
  drawSection(axisIndex: number, axisSeq: number): any {
    const widget = this.widget as Record<string, unknown>
    const integrate = widget.integrate
    const axis = this.chart.axis(axisIndex)
    const cw = axis.area('width')
    const ch = axis.area('height')

    return this.chart.svg.group({}, () => {
      const thumb = this.chart.svg.rect({
        height: ch,
        fill: this.chart.theme('zoomBackgroundColor'),
        opacity: 0.3,
      })

      const bg = this.chart.svg
        .group({ visibility: 'hidden' }, () => {
          this.chart.svg
            .group({ cursor: 'pointer' }, () => {
              this.chart.svg.circle({ r: R, cx: cw, cy: 0, opacity: 0 })

              this.chart.svg
                .path({
                  d: 'M12,2C6.5,2,2,6.5,2,12c0,5.5,4.5,10,10,10s10-4.5,10-10C22,6.5,17.5,2,12,2z M16.9,15.5l-1.4,1.4L12,13.4l-3.5,3.5 l-1.4-1.4l3.5-3.5L7.1,8.5l1.4-1.4l3.5,3.5l3.5-3.5l1.4,1.4L13.4,12L16.9,15.5z',
                  fill: this.chart.theme('zoomFocusColor'),
                })
                .translate(cw - R, -R)
            })
            .on('click', () => {
              bg.attr({ visibility: 'hidden' })

              if (integrate) {
                this.rollbackZoom(this.getAxisList())
              } else {
                this.rollbackZoom([axisIndex])
              }
            })
        })
        .translate(this.left + axis.area('x'), this.top + axis.area('y'))

      if (!integrate || axisSeq === 0) {
        this.setDragEvent(axisIndex, thumb, bg)
      } else {
        this.setDragEvent(axisIndex, null, null)
      }
    })
  }

  /** Restores every axis in `axisList` to its pre-zoom state: a `"block"` axis just calls
   * `axis.screen(1)`; a `"date"`/`"dateblock"` one restores the `domain`/`interval`/`format` cached
   * by `setDragEvent()`'s `updateDateObj()` (under `prevDomain_<axisIndex>` etc) and resets
   * `zoomDepth_<axisIndex>` back to 0 so the next zoom re-caches fresh "pre-zoom" values;
   * `"dateblock"` additionally calls `axis.screen(1)` too. Force-renders and emits `zoom.close`
   * once per axis restored. */
  rollbackZoom(axisList: number[]): void {
    for (let i = 0; i < axisList.length; i++) {
      const axisIndex = axisList[i]
      const axis = this.chart.axis(axisIndex)
      const xtype = (axis.get('x') as Record<string, unknown>).type

      if (xtype === 'block') {
        axis.screen(1)
      } else if (xtype === 'date' || xtype === 'dateblock') {
        const prevDomain = this.chart.getCache(`prevDomain_${axisIndex}`)
        const prevInterval = this.chart.getCache(`prevInterval_${axisIndex}`)
        const prevFormat = this.chart.getCache(`prevFormat_${axisIndex}`)

        axis.updateGrid('x', {
          domain: prevDomain,
          interval: prevInterval,
          format: prevFormat,
        })

        this.chart.setCache(`zoomDepth_${axisIndex}`, 0)

        if (xtype === 'dateblock') {
          axis.screen(1)
        }
      }

      if (!this.chart.isRender()) {
        this.chart.render()
      }

      this.chart.emit('zoom.close')
    }
  }

  /** Normalizes `widget.axis` into an array (a single index becomes a one-element array). */
  private getAxisList(): number[] {
    const widgetAxis = (this.widget as Record<string, unknown>).axis
    return Array.isArray(widgetAxis) ? widgetAxis : [widgetAxis as number]
  }

  /** Caches the chart's top/left padding, used to offset every axis section's drawn position in
   * `drawSection()`/`setDragEvent()`. */
  drawBefore = (): void => {
    this.top = this.chart.padding('top')
    this.left = this.chart.padding('left')
  }

  /** Draws one zoom overlay section (`drawSection()`) per axis in `widget.axis`. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const axisList = this.getAxisList()

    for (let i = 0; i < axisList.length; i++) {
      g.append(this.drawSection(axisList[i], i))
    }

    return g
  }

  /** Supplies `ZOOM_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return ZOOM_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('zoom', ZoomWidget)
