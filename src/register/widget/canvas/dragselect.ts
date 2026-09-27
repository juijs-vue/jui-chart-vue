// Port of legacy `src/widget/canvas/dragselect.js` ("chart.widget.canvas.dragselect", extend:
// "chart.widget.dragselect") - canvas-mode counterpart of `../dragselect.ts`'s `DragSelectWidget`.
// Reuses the parent's entire `setDragEvent()` event-wiring/data-matching logic unchanged (mouse
// down/move/up handling, block/range/date axis-pair matching, `dragselect.end` emission) - only
// the actual drawing differs: instead of mutating a persistent SVG `<rect>` element's attrs, it
// paints directly onto `this.canvas` (a raw `CanvasRenderingContext2D`) via
// `fillRect`/`strokeRect`/`clearRect`.
//
// This is NOT just a style preference - a canvas-mode `Builder` stacks its `<canvas>` elements ON
// TOP of the SVG layer (`jui-graph-ts`'s `Builder.init()` creates `this.svg` first, then
// `initCanvasElement()` appends `<canvas>` elements to `this.root` AFTER it - later DOM siblings
// paint on top). An SVG-drawn rect would render underneath the canvas and never be visible - the
// real, concrete reason the original needed a genuinely separate implementation here rather than
// just reusing `chart.widget.dragselect` as-is.
//
// `onDrawEnd(x,y,w,h)`'s 4 args - computed by the (shared, parent-class) `resetDragDraw()` as
// `chart.area("x")+axis.area("x")`, `chart.area("y")+axis.area("y")`, `axis.area("width")`,
// `axis.area("height")`, i.e. the WHOLE axis plotting area, not just the previous rect - are dead
// in the parent's own SVG `onDrawEnd` (see that file's own comment) but are load-bearing here:
// they fully clear the axis area on every mousemove tick before the next `onDrawStart` repaints
// the current rect - a canvas surface has no persistent "shape" to just re-attr like an SVG
// element, so the previous frame's pixels must be erased explicitly first.
//
// `draw()` returns an empty (but real, append/attr-able) SVG group - same shape `../picker.ts`
// (also a "canvas.*"-namespaced widget with no SVG output of its own) already established for
// this exact situation - never appending a visible thumb into it, since the actual rect is drawn
// straight onto `this.canvas` by `setDragEvent()`'s handlers instead.
import { registerWidget } from 'jui-graph-ts'
import { DragSelectWidget, DRAGSELECT_WIDGET_OWN_DEFAULTS } from '../dragselect'

export class CanvasDragSelectWidget extends DragSelectWidget {
  protected onDrawStart(x: number, y: number, w: number, h: number): void {
    const canvas = this.canvas as CanvasRenderingContext2D

    canvas.lineWidth = this.chart.theme('dragSelectBorderWidth')
    canvas.strokeStyle = this.chart.theme('dragSelectBorderColor')
    canvas.fillStyle = this.chart.theme('dragSelectBackgroundColor')
    canvas.globalAlpha = this.chart.theme('dragSelectBackgroundOpacity')

    const rx = w >= 0 ? x : x + w
    const ry = h >= 0 ? y : y + h
    const rw = w >= 0 ? w : Math.abs(w)
    const rh = h >= 0 ? h : Math.abs(h)

    canvas.fillRect(rx, ry, rw, rh)
    canvas.strokeRect(rx, ry, rw, rh)
  }

  protected onDrawEnd(x?: number, y?: number, w?: number, h?: number): void {
    ;(this.canvas as CanvasRenderingContext2D).clearRect(x ?? 0, y ?? 0, w ?? 0, h ?? 0)
  }

  draw = (): any => {
    const g = this.chart.svg.group()
    const bIndex = (this.widget as Record<string, unknown>).brush
    const bIndexes = Array.isArray(bIndex) ? bIndex : [bIndex as number]

    for (let i = 0; i < bIndexes.length; i++) {
      const brush = this.chart.get('brush', bIndexes[i])

      if (brush != null) {
        this.setDragEvent(brush)
      }
    }

    return g
  }

  static setup(): Record<string, unknown> {
    return DRAGSELECT_WIDGET_OWN_DEFAULTS
  }
}

registerWidget('canvas.dragselect', CanvasDragSelectWidget)
