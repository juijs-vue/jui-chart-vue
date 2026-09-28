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

/** `chart.widget.canvas.picker` - a thin event-relay widget: for each configured brush index,
 * wires `axis.click`/`axis.dblclick` (and `axis.mousemove` when `widget.hover` is set) handlers
 * that call whatever hit-test function the target brush registered via
 * `chart.setCache('picker', {obj, func})` (e.g. `canvas.bubblecloud`'s picker), re-emitting
 * `picker.click`/`picker.dblclick` chart events carrying the hit data. Despite its `canvas.*`
 * namespace, it extends `CoreWidget` directly (not `CanvasCoreWidget`) and does no canvas drawing
 * of its own - see this file's header comment. */
export class CanvasPickerWidget extends CoreWidget {
  /** Wires `axis.<eventType>` (scoped to `brush.axis`) so a click/dblclick on the axis calls
   * whatever hit-test function the target brush cached via `chart.setCache('picker', {obj, func})`
   * (see this file's header comment), and - only when it returns non-null data - re-emits
   * `picker.<eventType>` carrying `{brush, data}`. A no-op click when no brush has registered a
   * picker function yet. */
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

  /** Wires this brush's click/dblclick relaying (`emitActiveEvent()`, always) and, only when
   * `widget.hover` is set, an `axis.mousemove` handler too - unlike `emitActiveEvent()`, that hover
   * handler calls the cached picker function purely for its side effect (e.g. updating a hover
   * highlight inside the brush itself) and never re-emits a `picker.*` event of its own, regardless
   * of what the function returns. */
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

  /** Wires `setCanvasEvents()` for every brush index in `widget.brush`, and returns an empty
   * group - this widget only relays events, drawing nothing of its own visible content (see this
   * file's header comment). */
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

  /** Supplies `CANVAS_PICKER_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return CANVAS_PICKER_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('canvas.picker', CanvasPickerWidget)
