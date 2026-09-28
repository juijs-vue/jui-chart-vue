// Port of legacy `src/widget/canvas/picker.js` ("chart.widget.canvas.picker", extend:
// "chart.widget.core") - a thin event-relay widget: for each configured brush index, wires
// `axis.click`/`axis.dblclick`(/`axis.mousemove`, if `widget.hover`) handlers that call whatever
// hit-test function the target brush registered via `chart.setCache('picker', {obj, func})` (e.g.
// `canvas.bubblecloud`'s `BubbleCloud.pick`, `bubblecloud.ts`), re-emitting `picker.click`/
// `picker.dblclick` chart events carrying the hit data.
//
// **NOT `chart.widget.canvas.core`-derived, contrary to its `"canvas.*"` registration namespace**:
// confirmed from the legacy file's own `extend: "chart.widget.core"` field - it extends `CoreWidget`
// DIRECTLY, not `CanvasCoreWidget` (`jui-graph-ts`'s `widget/canvas/core.ts`), despite the
// `chart.widget.canvas.picker` name suggesting the latter. No canvas-context access of its own
// either - it only ever reads `chart.getCache('picker')`, set by whichever brush owns the actual
// canvas drawing.
import { CoreWidget, registerWidget } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

interface PickerCacheEntry {
  obj: unknown
  func: (this: unknown, x: number, y: number) => unknown
}

interface AxisMouseEvent {
  chartX: number
  chartY: number
}

/** `chart.widget.canvas.picker`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface CanvasPickerWidgetOptions {
  /** Also hit-test (and call the target brush's cached picker function) on `axis.mousemove`, not
   * just click/dblclick. */
  hover?: boolean
  /** Which brush(es) to relay click/dblclick(/mousemove) hit-testing for - a single index or an
   * array. Each referenced brush must register its own hit-test function via
   * `chart.setCache('picker', {obj, func})` (e.g. `canvas.bubblecloud`) - this widget only relays. */
  brush?: number | number[]
}

/** Own `chart.widget.canvas.picker.setup()` fields - see legacy `canvas/picker.js`. */
export const CANVAS_PICKER_WIDGET_OWN_DEFAULTS: CanvasPickerWidgetOptions = {
  hover: false,
  brush: [0],
}

export class CanvasPickerWidget extends CoreWidget {
  private emitActiveEvent(brush: Record<string, unknown>, eventType: string): void {
    this.on(
      `axis.${eventType}`,
      (e: AxisMouseEvent) => {
        const checker = this.chart.getCache('picker') as PickerCacheEntry | undefined

        if (checker != null) {
          const data = checker.func.call(checker.obj, e.chartX, e.chartY) as BrushData | null

          if (data != null) {
            this.chart.emit(`picker.${eventType}`, [{ brush, data }, e])
          }
        }
      },
      brush.axis as number,
    )
  }

  private setCanvasEvents(brush: Record<string, unknown>): void {
    const widget = this.widget as Record<string, unknown>

    if (widget.hover) {
      this.on(
        'axis.mousemove',
        (e: AxisMouseEvent) => {
          const checker = this.chart.getCache('picker') as PickerCacheEntry | undefined

          if (checker != null) {
            checker.func.call(checker.obj, e.chartX, e.chartY)
          }
        },
        brush.axis as number,
      )
    }

    this.emitActiveEvent(brush, 'click')
    this.emitActiveEvent(brush, 'dblclick')
  }

  draw = (): any => {
    const g = this.chart.svg.group()
    const widget = this.widget as Record<string, unknown>
    const bIndex = widget.brush
    const bIndexes = Array.isArray(bIndex) ? bIndex : [bIndex]

    for (let i = 0; i < bIndexes.length; i++) {
      const brush = this.chart.get('brush', bIndexes[i] as number) as Record<string, unknown>
      this.setCanvasEvents(brush)
    }

    return g
  }

  static setup(): Record<string, unknown> {
    return CANVAS_PICKER_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('canvas.picker', CanvasPickerWidget)
