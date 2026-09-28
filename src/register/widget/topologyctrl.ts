// Port of legacy `src/widget/topologyctrl.js` ("chart.widget.topologyctrl", extend:
// "chart.widget.core") - extends `CoreWidget` directly. Pan/zoom/drag-node interaction controller
// for a `topologynode` chart - reads/writes the SAME `axis.c(index)` mutator closures
// (`setX`/`setY`/`setScale`/`setView`) the `chart.grid.topologytable` grid's own `scale()` function
// returns (see `register/grid/topologytable.ts`'s header comment - this is the widget that was
// blocked pending that grid's registration, now unblocked). Draws NOTHING itself (`draw()` returns
// an empty group) - purely wires mouse/wheel event handlers onto the target `topologynode` brush's
// axis.
//
// **PRESERVED QUIRK**: `initDragEvent`'s per-node-drag handler writes `axis.cache.activeNodeKey =
// targetKey` when a node's own `mousedown` fires (in `setBrushEvent()`) - but `axis.cache`'s real
// shape, as initialized by `chart.grid.topologytable`'s own `drawBefore()`, only ever declares
// `{scale, viewX, viewY, nodeKey}` - `activeNodeKey` is a DIFFERENT key than `nodeKey` (the one
// `topologynode.js`'s own `createNodes()` actually reads, to decide `node.order = 1`). Confirmed by
// reading both files closely: this write is real but effectively dead - nothing in either file ever
// reads `axis.cache.activeNodeKey` back. Reproduced literally as `activeNodeKey`, not "corrected" to
// `nodeKey` to make it functional - a real, if likely accidental, upstream naming mismatch.
//
// **`renderChart()`'s debounce, literal**: batches re-renders via a single `setTimeout(..., 70)` -
// firing at most once per 70ms regardless of how many drag/wheel events land in that window
// (`renderWait` guard), and re-runs `setBrushEvent()` after each render (since a full render
// replaces the brush's DOM nodes, invalidating the previously-bound per-node `mousedown` handlers).
import { CoreWidget, registerWidget } from 'jui-graph-ts'

/** `chart.widget.topologyctrl`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface TopologyCtrlWidgetOptions {
  /** Enables panning (drag-to-move) the point of view of the topology map. */
  move?: boolean
  /** Enables mousewheel zoom in/out of the topology map. */
  zoom?: boolean
  /** Which `topologynode` brush index this widget controls. */
  brush?: number
}

/** Own `chart.widget.topologyctrl.setup()` fields - see legacy `topologyctrl.js`. */
export const TOPOLOGYCTRL_WIDGET_OWN_DEFAULTS: TopologyCtrlWidgetOptions = {
  move: false,
  zoom: false,
  brush: 0,
}

export class TopologyControlWidget extends CoreWidget {
  private ctrlAxis: any = null
  private targetKey: string | null = null
  private startX = 0
  private startY = 0
  private renderWait = false
  private scale = 1
  private boxX = 0
  private boxY = 0

  private renderChart(): void {
    if (this.renderWait === false) {
      setTimeout(() => {
        this.chart.render()
        this.setBrushEvent()

        this.renderWait = false
      }, 70)

      this.renderWait = true
    }
  }

  private initDragEvent(): void {
    const endDragAction = () => {
      if (typeof this.targetKey !== 'string') return
      this.targetKey = null
    }

    this.on(
      'axis.mousemove',
      (e: { chartX: number; chartY: number }) => {
        this.ctrlAxis.root.attr({ cursor: 'move' })
        if (typeof this.targetKey !== 'string') return

        const xy = this.ctrlAxis.c(this.targetKey)
        const dragX = e.chartX / xy.scale
        const dragY = e.chartY / xy.scale

        xy.setX(this.startX + (dragX - this.startX))
        xy.setY(this.startY + (dragY - this.startY))

        this.renderChart()
      },
      this.ctrlAxis.index,
    )

    this.on('axis.mouseup', endDragAction, this.ctrlAxis.index)
    this.on('bg.mouseup', endDragAction)
    this.on('bg.mouseout', endDragAction)
  }

  private initZoomEvent(): void {
    this.on(
      'axis.mousewheel',
      (e: WheelEvent & { wheelDelta?: number; detail?: number }) => {
        const delta = Math.max(-1, Math.min(1, e.wheelDelta || -(e.detail as number)))
        const xy = this.ctrlAxis.c(this.targetKey as string)

        if (delta > 0) {
          if (this.scale < 2) {
            this.scale += 0.1
          }
        } else {
          if (this.scale > 0.6) {
            this.scale -= 0.1
          }
        }

        xy.setScale(this.scale)
        this.renderChart()
      },
      this.ctrlAxis.index,
    )
  }

  private initMoveEvent(): void {
    let startX: number | null = null
    let startY: number | null = null

    const endMoveAction = () => {
      if (startX == null || startY == null) return

      startX = null
      startY = null
    }

    this.on(
      'axis.mousedown',
      (e: { x: number; y: number }) => {
        if (typeof this.targetKey === 'string') return
        if (startX != null || startY != null) return

        startX = this.boxX + e.x
        startY = this.boxY + e.y
      },
      this.ctrlAxis.index,
    )

    this.on(
      'axis.mousemove',
      (e: { x: number; y: number }) => {
        if (startX == null || startY == null) return

        const xy = this.ctrlAxis.c(this.targetKey as string)
        this.boxX = startX - e.x
        this.boxY = startY - e.y

        xy.setView(-this.boxX, -this.boxY)
        this.renderChart()
      },
      this.ctrlAxis.index,
    )

    this.on('chart.mouseup', endMoveAction)
    this.on('chart.mouseout', endMoveAction)
    this.on('bg.mouseup', endMoveAction)
    this.on('bg.mouseout', endMoveAction)
  }

  private getBrushElement(): any {
    const children = this.svg.root.get(0).children
    let index = 0
    let element = null

    for (let i = 0; i < children.length; i++) {
      const cls = children[i].attr('class')

      if (cls && cls.indexOf('topologynode') !== -1) {
        if (index === (this.widget as Record<string, unknown>).brush) {
          element = children[i]
          break
        }

        index++
      }
    }

    return element
  }

  private setBrushEvent(): void {
    const element = this.getBrushElement()
    if (element == null) return

    element.each((_i: number, node: any) => {
      const index = parseInt(node.attr('index'), 10)
      if (isNaN(index)) return

      node.on('mousedown', () => {
        if (typeof this.targetKey === 'string') return

        const key = this.ctrlAxis.getValue(this.ctrlAxis.data[index], 'key')
        const xy = this.ctrlAxis.c(key)

        this.targetKey = key
        this.startX = xy.x / xy.scale
        this.startY = xy.y / xy.scale

        this.ctrlAxis.cache.activeNodeKey = this.targetKey

        // 선택한 노드 맨 마지막으로 이동
        // xy.moveLast();
      })
    })
  }

  draw = (): any => {
    const widget = this.widget as Record<string, unknown>
    const brush = this.chart.get('brush', widget.brush)

    this.ctrlAxis = this.chart.axis(brush.axis)

    if (widget.zoom) {
      this.initZoomEvent()
    }

    if (widget.move) {
      this.initMoveEvent()
    }

    this.initDragEvent()
    this.setBrushEvent()

    return this.chart.svg.group()
  }

  static setup(): Record<string, unknown> {
    return TOPOLOGYCTRL_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('topologyctrl', TopologyControlWidget)
