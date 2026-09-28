// Canvas-mode counterpart to `register/widget/dragselect.ts` ("chart.widget.dragselect") -
// registered as "canvas.dragselect" (no legacy source: the real jQuery-era `jui-chart` engine
// never shipped this variant; the plain SVG "dragselect" was the only rubber-band widget it had).
//
// **Why this exists**: `Builder.init()` (`base/builder.ts`) creates `this.svg` first, then (when
// `options.canvas` is set) appends canvas elements to the SAME `root` afterward - later DOM
// siblings paint on top of earlier ones for absolutely-positioned elements (`initCanvasElement()`
// sets `position: absolute` on every canvas element), so an SVG-rendered rubber-band rect (the
// plain "dragselect" widget's own `this.svg.rect(...)`) would always render BEHIND a canvas-mode
// chart's own canvas-drawn content (e.g. `canvas.scatter`'s points) - functionally invisible, not
// merely occluded on overlap. Confirmed by reading `Builder.init()`/`initCanvasElement()` directly,
// not assumed.
//
// **Why a real canvas.* widget, not a workaround**: `CanvasCoreWidget` (`jui-graph-ts`'s
// `widget/canvas/core.ts`) is a near-empty base (only overrides `drawAfter` to skip the CSS-class
// stamp `CoreWidget.drawAfter` would otherwise add) - no concrete widget subclass anywhere in this
// project used it for real canvas drawing before this file. What actually makes canvas drawing
// possible for a widget: `Builder.drawWidget()` (`base/builder.ts`) wires `draw.canvas =
// this._canvas.sub` onto EVERY widget instance (confirmed by reading that method), separately from
// `drawBrush()`'s `draw.canvas = this._canvas.buffer` - widgets get their OWN canvas layer
// ("sub"), appended to `root` AFTER "main" (so it paints on top of everything, brushes' canvas
// content included - exactly what a drag-select overlay needs), and never touched by
// `resetCanvasElement("main")`'s per-frame buffer blit. This widget is simply the first to
// actually use that already-wired `this.canvas` context for real drawing.
//
// **Event/data-search logic below is copied verbatim from `dragselect.ts`** (not re-derived) -
// only `onDrawStart`/`onDrawEnd`/`draw()` differ, since those are the only SVG-element-specific
// parts of the original. See that file's own header comment for the behavior this shares
// (all four `emitDataList()` axis-type-pair branches, the `dataType: "list"` vs `"area"` split,
// etc).
import { CanvasCoreWidget, registerWidget } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** `chart.widget.canvas.dragselect`'s own config fields - same shape/semantics as plain
 * `"dragselect"` (`register/widget/dragselect.ts`'s `DragSelectWidgetOptions`), just drawn onto
 * the widget's own canvas layer instead of an SVG rect (see this file's header comment for why). */
export interface CanvasDragSelectWidgetOptions {
  /** Which brush(es) to rubber-band select over - a single index or an array. Same "last-created
   * rect wins with more than one entry" caveat as the plain `dragselect` widget. */
  brush?: number | number[]
  /** `'list'` emits the matched data rows on drag-end; `'area'` emits just the dragged
   * value-range instead. */
  dataType?: 'list' | 'area'
}

/** Own `chart.widget.canvas.dragselect.setup()` fields - same shape as plain "dragselect". */
export const CANVAS_DRAGSELECT_WIDGET_OWN_DEFAULTS: CanvasDragSelectWidgetOptions = {
  brush: [0],
  dataType: 'list',
}

export class CanvasDragSelectWidget extends CanvasCoreWidget {
  // The last rect actually painted, in the SAME "sub" canvas - tracked so `clearThumb()` only
  // ever clears the small region the rubber band occupies (not the whole canvas, which would risk
  // interfering with anything else future work ever draws onto "sub"), and once its own value at
  // that, not needing any dependency on the chart's overall width/height.
  private lastRect: { x: number; y: number; w: number; h: number } | null = null

  /** Clears just the region `this.lastRect` occupies (padded 2px on every side to also erase the
   * stroke drawn just outside the fill rect - see this field's own doc comment) rather than the
   * whole canvas, and resets `lastRect` to `null`. No-ops when nothing has been drawn yet. */
  private clearThumb(): void {
    const ctx = this.canvas as CanvasRenderingContext2D
    if (this.lastRect == null) return

    // +2px pad on every side: covers the 1px (theme default) stroke this widget draws just
    // outside the fill rect's own edge, so clearing never leaves a stray border fragment behind.
    const { x, y, w, h } = this.lastRect
    ctx.clearRect(x - 2, y - 2, w + 4, h + 4)
    this.lastRect = null
  }

  /** Erases the previous frame's rubber-band rect (`clearThumb()`) and paints a new one spanning
   * `(x,y)` to `(x+w, y+h)` directly onto the widget's own canvas layer, normalizing a negative
   * `w`/`h` the same way the SVG version's `onDrawStart` does - `(x,y)` is treated as the FAR corner
   * when dragging up/left. Styled from the `dragSelectBackgroundColor`/`dragSelectBackgroundOpacity`/
   * `dragSelectBorderColor`/`dragSelectBorderWidth` theme keys, then records the painted rect as
   * `this.lastRect` so the next frame (or `onDrawEnd()`) knows what to erase. */
  private onDrawStart(x: number, y: number, w: number, h: number): void {
    this.clearThumb()

    // Same normalization the SVG version's `onDrawStart` does (`(w >= 0) ? x : x + w`, etc) - a
    // negative width/height (dragging up/left) means `(x,y)` is the FAR corner, not the near one.
    const rx = w >= 0 ? x : x + w
    const ry = h >= 0 ? y : y + h
    const rw = Math.abs(w)
    const rh = Math.abs(h)

    const ctx = this.canvas as CanvasRenderingContext2D
    ctx.save()
    ctx.fillStyle = this.chart.theme('dragSelectBackgroundColor') as string
    ctx.globalAlpha = this.chart.theme('dragSelectBackgroundOpacity') as number
    ctx.fillRect(rx, ry, rw, rh)
    ctx.globalAlpha = 1
    ctx.strokeStyle = this.chart.theme('dragSelectBorderColor') as string
    ctx.lineWidth = this.chart.theme('dragSelectBorderWidth') as number
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.restore()

    this.lastRect = { x: rx, y: ry, w: rw, h: rh }
  }

  /** Erases the currently-painted rubber-band rect (`clearThumb()`) when a drag ends. */
  private onDrawEnd(): void {
    this.clearThumb()
  }

  // --- Everything below is a verbatim copy of dragselect.ts's setDragEvent - see that file. ---
  /** Verbatim copy of `dragselect.ts`'s `setDragEvent()` (see that file's own doc comment for the
   * full mousedown/mousemove/mouseup gesture and the `emitDataList()`/`emitDragArea()` split) -
   * only the SVG-vs-canvas-specific `onDrawStart()`/`onDrawEnd()` calls it makes differ. */
  private setDragEvent(brush: Record<string, unknown>): void {
    const axis = this.chart.axis(brush.axis as number)
    let isMove = false
    let mouseStartX = 0
    let mouseStartY = 0
    let thumbWidth = 0
    let thumbHeight = 0
    let startValueX: unknown = 0
    let startValueY: unknown = 0

    const resetDragDraw = () => {
      this.onDrawEnd()
    }

    const emitDataList = (sx: unknown, sy: unknown, ex: unknown, ey: unknown) => {
      const xType = axis.x?.type
      const yType = axis.y?.type
      const datas = axis.data as BrushData[]
      const targets = brush.target as string[]
      const dataInDrag: { brush: Record<string, unknown>; dataIndex: number; dataKey: string; data: BrushData }[] = []

      const getTargetData = (index: number, key: string, data: BrushData) => ({
        brush,
        dataIndex: index,
        dataKey: key,
        data,
      })

      for (let i = 0; i < datas.length; i++) {
        const d = datas[i]

        for (let j = 0; j < targets.length; j++) {
          const v = d[targets[j]] as number

          if (xType === 'date' && yType === 'range') {
            let date: unknown = d[(axis.get('x') as Record<string, unknown>).key as string]

            if (typeof date === 'number' && Number.isInteger(date)) {
              date = new Date(date)
            }

            if (date instanceof Date) {
              const sxd = sx as Date
              const exd = ex as Date
              if (date.getTime() >= sxd.getTime() && date.getTime() <= exd.getTime() && v >= (sy as number) && v <= (ey as number)) {
                dataInDrag.push(getTargetData(i, targets[j], d))
              }
            }
          } else if (xType === 'range' && yType === 'date') {
            let date: unknown = d[(axis.get('y') as Record<string, unknown>).key as string]

            if (typeof date === 'number' && Number.isInteger(date)) {
              date = new Date(date)
            }

            if (date instanceof Date) {
              const syd = sy as Date
              const eyd = ey as Date
              if (date.getTime() >= syd.getTime() && date.getTime() <= eyd.getTime() && v >= (sx as number) && v <= (ex as number)) {
                dataInDrag.push(getTargetData(i, targets[j], d))
              }
            }
          }

          if (xType === 'block' && yType === 'range') {
            if (i >= (sx as number) - 1 && i <= (ex as number) - 1 && v >= (sy as number) && v <= (ey as number)) {
              dataInDrag.push(getTargetData(i, targets[j], d))
            }
          } else if (xType === 'range' && yType === 'block') {
            if (i >= (sy as number) - 1 && i <= (ey as number) - 1 && v >= (sx as number) && v <= (ex as number)) {
              dataInDrag.push(getTargetData(i, targets[j], d))
            }
          }
        }
      }

      this.chart.emit('dragselect.end', [dataInDrag])
    }

    const emitDragArea = (sx: unknown, sy: unknown, ex: unknown, ey: unknown) => {
      this.chart.emit('dragselect.end', [{ x1: sx, y1: sy, x2: ex, y2: ey }])
    }

    const searchDataInDrag = (endValueX: unknown, endValueY: unknown) => {
      if ((startValueX as number) > (endValueX as number)) {
        const temp = startValueX
        startValueX = endValueX
        endValueX = temp
      }

      if ((startValueY as number) > (endValueY as number)) {
        const temp = startValueY
        startValueY = endValueY
        endValueY = temp
      }

      if ((this.widget as Record<string, unknown>).dataType === 'area') {
        emitDragArea(startValueX, startValueY, endValueX, endValueY)
      } else {
        emitDataList(startValueX, startValueY, endValueX, endValueY)
      }
    }

    const resetDragStatus = () => {
      isMove = false
      mouseStartX = 0
      mouseStartY = 0
      thumbWidth = 0
      thumbHeight = 0
      startValueX = 0
      startValueY = 0

      resetDragDraw()
    }

    const endZoomAction = (e: { chartX: number; chartY: number }) => {
      isMove = false
      if (thumbWidth === 0 || thumbHeight === 0) return

      searchDataInDrag(axis.x.invert(e.chartX), axis.y.invert(e.chartY))
      resetDragStatus()
    }

    this.on(
      'axis.mousedown',
      (e: { bgX: number; bgY: number; chartX: number; chartY: number }) => {
        if (isMove) return

        isMove = true
        mouseStartX = e.bgX
        mouseStartY = e.bgY
        startValueX = axis.x.invert(e.chartX)
        startValueY = axis.y.invert(e.chartY)

        this.chart.emit('dragselect.start')
      },
      brush.axis as number,
    )

    this.on(
      'axis.mousemove',
      (e: { bgX: number; bgY: number }) => {
        if (!isMove) return

        thumbWidth = e.bgX - mouseStartX
        thumbHeight = e.bgY - mouseStartY

        this.onDrawStart(mouseStartX, mouseStartY, thumbWidth, thumbHeight)
      },
      brush.axis as number,
    )

    this.on('axis.mouseup', endZoomAction, brush.axis as number)
    this.on('chart.mouseup', endZoomAction)
    this.on('bg.mouseup', endZoomAction)
  }

  /** Wires `setDragEvent()` for each brush index in `widget.brush` that resolves to a real brush
   * config (same `Builder.get('brush', key)` fallback quirk `dragselect.ts` documents). Returns
   * `void`, not a group - this widget paints directly onto its own canvas layer rather than
   * returning an SVG element tree (see this file's header comment on why a canvas-drawn overlay is
   * needed for canvas-mode charts). */
  draw = (): void => {
    const bIndex = (this.widget as Record<string, unknown>).brush
    const bIndexes = Array.isArray(bIndex) ? bIndex : [bIndex as number]

    for (let i = 0; i < bIndexes.length; i++) {
      // Same engine-wide `Builder.get('brush', key)` quirk `dragselect.ts` documents (never
      // actually returns null for a missing key - falls back to the whole brush array).
      const brush = this.chart.get('brush', bIndexes[i])

      if (brush != null) {
        this.setDragEvent(brush)
      }
    }
  }

  /** Supplies `CANVAS_DRAGSELECT_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return CANVAS_DRAGSELECT_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('canvas.dragselect', CanvasDragSelectWidget)
