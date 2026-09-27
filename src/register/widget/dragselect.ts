// Port of legacy `src/widget/dragselect.js` ("chart.widget.dragselect", extend:
// "chart.widget.core") - extends `CoreWidget` directly. Drags a live rubber-band rectangle over
// one or more configured brushes' axes and, on release, either emits the matched data rows
// (`dataType: "list"`, the default) or just the dragged value-range itself (`dataType: "area"`) -
// purely a passive notification widget, never calls `axis.zoom()`/re-renders on its own (confirmed
// by reading the whole file - genuinely different from `zoom.ts`'s drag, which rewrites the axis's
// real domain).
//
// **All four `emitDataList()` axis-type-pair branches ported literally (date+range, range+date,
// block+range, range+block)** - unlike `main` branch's own `useDragSelect.ts` port, which
// deliberately collapsed these to just the block/range pair since ITS OWN axis system only ever
// has `'block' | 'range'` types. This project's `jui-graph-ts`-backed axis system has a REAL
// `DateGrid` (`type: "date"`), so the date+range/range+date branches are genuinely reachable here
// and are ported as literal, unmodified translations of the original's own per-branch logic - not
// reduced to `main`'s pixel-space reformulation (a real, source-confirmed behavior difference this
// port is positioned to preserve that `main`'s couldn't be).
//
// **PRESERVED QUIRK**: `thumb` is a single closure variable shared across every configured brush
// in `draw()`'s own loop - each iteration reassigns it and wires a NEW `setDragEvent(brush)`
// closure, but every one of those closures' `onDrawStart`/`onDrawEnd` calls read/write the SAME
// outer `thumb` reference. With more than one entry in `widget.brush`, every brush's drag handlers
// end up drawing into whichever rect was created LAST, not their own - reproduced as a literal
// single instance field here (`this.thumb`), not per-brush state, matching the original exactly.
import { CoreWidget, registerWidget } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** Own `chart.widget.dragselect.setup()` fields - see legacy `dragselect.js`. */
export const DRAGSELECT_WIDGET_OWN_DEFAULTS = {
  brush: [0] as number | number[],
  dataType: 'list', // or "area"
}

export class DragSelectWidget extends CoreWidget {
  protected thumb: any = null

  // `protected`, not `private`: `./canvas/dragselect.ts`'s `CanvasDragSelectWidget` subclasses
  // this whole class, overriding these two draw methods (canvas-mode `Builder`s stack their
  // `<canvas>` elements ON TOP of the SVG layer - an SVG-drawn rect would render underneath it and
  // never be visible - see that file's own header comment) while reusing `setDragEvent()`'s
  // mouse-event-wiring/data-matching logic unchanged.
  protected onDrawStart(x: number, y: number, w: number, h: number): void {
    this.thumb.attr({
      width: w >= 0 ? w : Math.abs(w),
      height: h >= 0 ? h : Math.abs(h),
    })

    this.thumb.translate(w >= 0 ? x : x + w, h >= 0 ? y : y + h)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onDrawEnd(_x?: number, _y?: number, _w?: number, _h?: number): void {
    this.thumb.attr({ width: 0, height: 0 })
  }

  protected setDragEvent(brush: Record<string, unknown>): void {
    const axis = this.chart.axis(brush.axis as number)
    let isMove = false
    let mouseStartX = 0
    let mouseStartY = 0
    let thumbWidth = 0
    let thumbHeight = 0
    let startValueX: unknown = 0
    let startValueY: unknown = 0

    // The original computes and passes 4 real coordinate args here (`self.chart.area("x") +
    // axis.area("x")`, etc - the WHOLE axis plotting area, not just the previous rect) to
    // `onDrawEnd(x,y,w,h)`. This class's OWN `onDrawEnd` never reads them (`thumb.attr({width:0,
    // height:0})` is hardcoded) - inert here, exactly as in the original. They're NOT dead in
    // general, though: `./canvas/dragselect.ts`'s `CanvasDragSelectWidget` overrides `onDrawEnd`
    // to `this.canvas.clearRect(x,y,w,h)` with these exact args, and actually needs them - a
    // canvas surface has no persistent "shape" to just re-attr like an SVG element, so the
    // previous frame's pixels must be wiped explicitly before the next `onDrawStart` repaints the
    // current rect. Computed unconditionally here (not just when a canvas subclass is in play)
    // since it's cheap and keeps this one `resetDragDraw` shared verbatim by both.
    const resetDragDraw = () => {
      this.onDrawEnd(this.chart.area("x") + axis.area("x"), this.chart.area("y") + axis.area("y"), axis.area("width"), axis.area("height"))
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

        resetDragDraw()
        this.onDrawStart(mouseStartX, mouseStartY, thumbWidth, thumbHeight)
      },
      brush.axis as number,
    )

    this.on('axis.mouseup', endZoomAction, brush.axis as number)
    this.on('chart.mouseup', endZoomAction)
    this.on('bg.mouseup', endZoomAction)
  }

  draw = (): any => {
    const g = this.chart.svg.group()
    const bIndex = (this.widget as Record<string, unknown>).brush
    const bIndexes = Array.isArray(bIndex) ? bIndex : [bIndex as number]

    for (let i = 0; i < bIndexes.length; i++) {
      const brush = this.chart.get('brush', bIndexes[i])

      // **NOTE, not a dragselect-specific quirk**: `Builder.get('brush', key)` never actually
      // returns `null`/`undefined` for a missing `key` - it falls back to returning the WHOLE
      // `_brush` array instead (confirmed by reading `Builder.get()` itself: `if (obj[type][key])
      // return obj[type][key]; return obj[type];`). This `!= null` guard therefore only ever
      // skips a brush when NO brushes are configured at all (an empty array is still non-null,
      // but this loop never even runs `chart.get(...)` unless `widget.brush` was configured,
      // whose own default is `[0]`) - a real, if surprising, engine-wide quirk this widget merely
      // inherits, reproduced exactly, not special-cased around.
      if (brush != null) {
        this.thumb = this.svg.rect({
          width: 0,
          height: 0,
          stroke: this.chart.theme('dragSelectBorderColor'),
          'stroke-width': this.chart.theme('dragSelectBorderWidth'),
          fill: this.chart.theme('dragSelectBackgroundColor'),
          'fill-opacity': this.chart.theme('dragSelectBackgroundOpacity'),
        })

        this.setDragEvent(brush)
        g.append(this.thumb)
      }
    }

    return g
  }

  static setup(): Record<string, unknown> {
    return DRAGSELECT_WIDGET_OWN_DEFAULTS
  }
}

registerWidget('dragselect', DragSelectWidget)
