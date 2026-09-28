// Port of legacy `src/widget/zoomselect.js` ("chart.widget.zoomselect", extend:
// "chart.widget.core") - extends `CoreWidget` directly. Drags a horizontal band over one or more
// configured axes; on release, computes either a block-index range (`xtype === "block"`) or a
// date-value range (`"date"`/`"dateblock"`, using the drag-start/drag-end pixel positions inverted
// through `axis.x`) and emits `zoomselect.end` with the computed `[start, end]` (or
// `[stime, etime]`, possibly concatenated with a block range too for `"dateblock"`) - a small "×"
// close button appears on the highlighted band afterward, whose click emits `zoomselect.close`
// (does NOT re-zoom or clear anything on its own - a passive notification widget, same category as
// `dragselect.ts`, not a self-contained zoom like `zoom.ts`).
//
// **PRESERVED QUIRK**: `this.rollbackZoom = function() { this.chart.emit("zoomselect.close"); }`
// takes NO parameters, but is always CALLED with one (`self.rollbackZoom(axisIndex)` in the close-
// button's own click handler) - a real, inert extra argument (same "drop an already-100%-inert
// argument" precedent used elsewhere in this project), not a sign `rollbackZoom` was meant to use
// it.
//
// **PRESERVED QUIRK**: `updateBlockGrid()`'s own `if (start >= end) return [start, end];` branch
// returns the EXACT SAME `[start, end]` pair as the line immediately after it (`return [start,
// end];`, unconditionally reached either way) - a genuine no-op conditional in the real source
// (confirmed by reading both branches: they're identical), not a guard that changes behavior.
// Reproduced as a single unconditional return, matching the ACTUAL behavior (not the source's
// literal dead branching, which would be pure noise to reproduce with no observable difference).
import { CoreWidget, registerWidget } from 'jui-graph-ts'

const R = 12

/** `chart.widget.zoomselect`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface ZoomSelectWidgetOptions {
  /** Which axis (or axes) to draw a drag-to-select band over - a single index or an array.
   * Unlike `zoom.ts`, this widget only emits `zoomselect.end`/`zoomselect.close` - it never
   * rewrites the axis domain itself. */
  axis?: number | number[]
}

/** Own `chart.widget.zoomselect.setup()` fields - see legacy `zoomselect.js`. */
export const ZOOMSELECT_WIDGET_OWN_DEFAULTS: ZoomSelectWidgetOptions = {
  axis: 0,
}

/** `chart.widget.zoomselect` - drags a horizontal band over one or more configured axes and, on
 * release, emits `zoomselect.end` with the computed `[start, end]` range (a block-index pair, a
 * date-value pair, or both concatenated for `"dateblock"` axes), plus an "×" close button that
 * emits `zoomselect.close`. Purely a passive notification widget - unlike `zoom.ts`'s drag-select,
 * it never rewrites the axis's own domain or re-zooms on its own. See this file's header comment
 * for the preserved `rollbackZoom()` inert-argument quirk and the `updateBlockGrid()` no-op branch. */
export class ZoomSelectWidget extends CoreWidget {
  private top = 0
  private left = 0

  /** Wires the drag-to-select gesture for `axisIndex`: `axis.mousedown` starts tracking (caching
   * `startDate` via `axis.x.invert()` for `"date"`/`"dateblock"` axes), `axis.mousemove` resizes the
   * drag `thumb` rect and, once dragging (`bg != null`), shows/repositions the highlighted `bg`
   * band's close-button. On release (`axis.mouseup`/`chart.mouseup`/`bg.mouseup`/`bg.mouseout`),
   * computes the selected range - a block-index pair via `updateBlockGrid()` for a `"block"` x-axis,
   * or a date-value pair via `updateDateObj()` for `"date"`/`"dateblock"` (concatenated with a block
   * range too for `"dateblock"`) - reveals the close-button overlay (`renderChart()`), and emits
   * `zoomselect.end` with the computed range. Unlike `zoom.ts`'s twin, never rewrites the axis's own
   * domain - purely a passive notification (see this file's header comment). */
  private setDragEvent(axisIndex: number, thumb: any, bg: any): void {
    const axis = this.chart.axis(axisIndex)
    const xtype = (axis.get('x') as Record<string, unknown>).type
    let startDate: Date | null = null
    let isMove = false
    let mouseStart = 0
    let thumbWidth = 0

    const updateBlockGrid = (): [number, number] => {
      const range = axis.end - axis.start
      const tick = axis.area('width') / (range > 0 ? range : axis.data.length)
      const x = (thumbWidth > 0 ? mouseStart : mouseStart + thumbWidth) - this.left
      const start = Math.floor(x / tick) + axis.start
      const end = Math.ceil((x + Math.abs(thumbWidth)) / tick) + axis.start

      return [start, end]
    }

    const updateDateObj = (endDate: Date): [number, number] => {
      const stime = (startDate as Date).getTime()
      const etime = endDate.getTime()

      if (stime >= etime) return [etime, stime]

      return [stime, etime]
    }

    const renderChart = () => {
      if (bg != null) {
        const w = thumb.attributes.width

        bg.attr({ visibility: 'visible' })
        bg.get(0).attr({ width: w })
        bg.get(1).get(0).attr({ width: w })
        bg.get(1).get(1).translate(w - R, -R)
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
      let args: number[] = []

      isMove = false
      if (thumbWidth === 0) return

      if (xtype === 'block') {
        args = updateBlockGrid()
      } else {
        if (startDate != null) {
          args = updateDateObj(axis.x.invert(e.chartX))

          if (xtype === 'dateblock') {
            args = args.concat(updateBlockGrid())
          }
        }
      }

      renderChart()
      resetDragStatus()

      this.chart.emit('zoomselect.end', args)
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

        this.chart.emit('zoomselect.start')
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
            thumb.attr({ width: thumbWidth }).translate(mouseStart, this.top + axis.area('y'))

            bg.get(1).get(0).attr({ cx: thumbWidth })
            bg.translate(mouseStart, this.top + axis.area('y'))
          } else {
            thumb.attr({ width: Math.abs(thumbWidth) }).translate(mouseStart + thumbWidth, this.top + axis.area('y'))

            bg.get(1).get(0).attr({ cx: Math.abs(thumbWidth) })
            bg.translate(mouseStart + thumbWidth, this.top + axis.area('y'))
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

  /** Draws one axis's select overlay: a semi-transparent drag-band `thumb` plus a hidden highlighted
   * `bg` group (a filled rect + "×" close-button) that becomes visible once a drag completes, and
   * wires the drag gesture via `setDragEvent()`. Unlike `zoom.ts`'s `drawSection()`, there's no
   * `widget.integrate` concept here - every configured axis always gets its own independent drag
   * handlers. */
  drawSection(axisIndex: number): any {
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
          this.chart.svg.rect({
            width: cw,
            height: ch,
            fill: this.chart.theme('zoomFocusColor'),
            opacity: 0.2,
          })

          this.chart.svg
            .group({ cursor: 'pointer' }, () => {
              this.chart.svg.circle({ r: R, opacity: 0 })

              this.chart.svg
                .path({
                  d: 'M12,2C6.5,2,2,6.5,2,12c0,5.5,4.5,10,10,10s10-4.5,10-10C22,6.5,17.5,2,12,2z M16.9,15.5l-1.4,1.4L12,13.4l-3.5,3.5 l-1.4-1.4l3.5-3.5L7.1,8.5l1.4-1.4l3.5,3.5l3.5-3.5l1.4,1.4L13.4,12L16.9,15.5z',
                  fill: this.chart.theme('zoomFocusColor'),
                })
                .translate(cw - R, -R)
            })
            .on('click', () => {
              bg.attr({ visibility: 'hidden' })

              this.rollbackZoom()
            })
        })
        .translate(this.left + axis.area('x'), this.top + axis.area('y'))

      this.setDragEvent(axisIndex, thumb, bg)
    })
  }

  /** Just emits `zoomselect.close` - unlike `zoom.ts`'s `rollbackZoom()`, does no actual domain
   * restoration itself (there's no domain to restore - this widget never rewrote one). Per this
   * file's header comment, real callers pass an (unused) `axisIndex` argument despite this method
   * taking none. */
  rollbackZoom(): void {
    this.chart.emit('zoomselect.close')
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

  /** Draws one select overlay section (`drawSection()`) per axis in `widget.axis`. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const axisList = this.getAxisList()

    for (let i = 0; i < axisList.length; i++) {
      g.append(this.drawSection(axisList[i]))
    }

    return g
  }

  /** Supplies `ZOOMSELECT_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return ZOOMSELECT_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('zoomselect', ZoomSelectWidget)
