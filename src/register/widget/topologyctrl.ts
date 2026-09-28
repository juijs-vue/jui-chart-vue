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

  /** Debounces re-renders during a continuous drag/wheel interaction: fires `chart.render()` (and
   * re-wires the brush's per-node handlers via `setBrushEvent()`, since a render replaces the
   * brush's DOM) at most once per 70ms, per this file's header comment. Additional calls while a
   * render is already pending (`renderWait`) are silently dropped. */
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

  /** Wires per-node dragging (scoped to `this.ctrlAxis.index`, so `axis.mousemove` only fires for
   * `ctrlAxis`): while `this.targetKey` is set (by `setBrushEvent()`'s own node `mousedown`
   * handler), each move recomputes that node's `x`/`y` via the axis's `axis.c(key)` mutator
   * closures (`setX`/`setY`) and debounces a re-render through `renderChart()`. `axis.mouseup`/
   * `bg.mouseup`/`bg.mouseout` clear `targetKey`, ending the drag. Always wired in `draw()`
   * regardless of `widget.move`/`widget.zoom` - node dragging is unconditional. */
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

  /** Only wired when `widget.zoom` is enabled: `axis.mousewheel` nudges `this.scale` by ±0.1
   * (clamped to `[0.6, 2]`) per wheel notch (`e.wheelDelta`, falling back to the negated legacy
   * `e.detail` for browsers without it) and applies it via `axis.c(this.targetKey).setScale()`,
   * debouncing a re-render through `renderChart()`. This writes a GLOBAL scale, not a per-node one,
   * regardless of `this.targetKey`'s value: `chart.grid.topologytable`'s own `setScale()` mutator
   * (see `register/grid/topologytable.ts`) never actually reads its enclosing `axis.c(index)` call's
   * `index` argument, so calling it with `targetKey` still `null` (no node currently being dragged)
   * works identically to calling it with a real key - confirmed by reading that grid's `scale()`
   * factory directly, not assumed. */
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

  /** Only wired when `widget.move` is enabled: `axis.mousedown` starts a pan (skipped while a node
   * drag is in progress, i.e. `this.targetKey` is already a string), tracking the mouse's start
   * offset against the CURRENT box offset (`this.boxX`/`this.boxY`); `axis.mousemove` updates
   * `boxX`/`boxY` from the drag delta and applies the pan via `axis.c(this.targetKey).setView()` -
   * like `initZoomEvent()`'s `setScale()`, this writes a global view offset regardless of
   * `targetKey`'s value, since `setView()` also ignores its enclosing call's index argument (see
   * `register/grid/topologytable.ts`). `chart.mouseup`/`chart.mouseout`/`bg.mouseup`/`bg.mouseout`
   * end the pan. */
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

  /** Finds the root SVG group for `widget.brush`'s `topologynode` brush among the chart root's
   * children, by counting only children whose `class` attribute contains `'topologynode'` (since
   * `widget.brush` is a brush-type-relative index, not a direct child index - other brush types'
   * elements are skipped when counting) until the `widget.brush`-th one is found. `null` when no
   * such element exists yet. */
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

  /** (Re-)wires per-node `mousedown` handlers on every child of the brush element found by
   * `getBrushElement()`, keyed by each node's own `index` attribute. On `mousedown` (only when no
   * other node is already being dragged, i.e. `this.targetKey` is unset), resolves that node's data
   * key via `ctrlAxis.getValue(...)`, caches its current unscaled `x`/`y` as the drag's start
   * position, and sets `this.targetKey` - which `initDragEvent()`'s `axis.mousemove` handler then
   * reads. Also writes `axis.cache.activeNodeKey` - a real, but dead, write per this file's own
   * header comment (nothing ever reads that key back; the grid's own `nodeKey` field is different
   * and unaffected). Must be re-run after every re-render (see `renderChart()`'s own doc comment)
   * since a render replaces the brush's DOM nodes, invalidating these handlers. */
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

  /** Resolves `widget.brush`'s axis, conditionally wires panning/zoom (`initMoveEvent()`/
   * `initZoomEvent()`, gated on `widget.move`/`widget.zoom`), always wires node dragging
   * (`initDragEvent()`) and the per-node click targets (`setBrushEvent()`), and returns an empty
   * group - this widget draws nothing visible of its own, per this file's header comment. */
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

  /** Supplies `TOPOLOGYCTRL_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return TOPOLOGYCTRL_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('topologyctrl', TopologyControlWidget)
