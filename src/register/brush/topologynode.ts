// Port of legacy `src/brush/topologynode.js` ("chart.brush.topologynode", extend:
// "chart.brush.core") - extends `CoreBrush` directly. A force-directed-style node/edge network
// diagram: nodes are positioned via `axis.c(index)` (a "c"/custom axis grid slot, like
// `arcequalizer`/`pie`/`donut`/etc.'s auto-registered "panel" grid - see those files' own header
// comments), and edges connect node pairs listed in each row's own `outgoing` array.
//
// **OPEN QUESTION / KNOWN GAP - flagged, not decided**: the real legacy demo for this brush
// (`examples/topology.html`) ALWAYS configures `axis: [{ c: { type: "topologytable" }, ... }]` -
// NOT the auto-registered "panel" grid `arcequalizer`/`pie`/etc. use. `chart.grid.topologytable`
// (legacy `src/grid/topologytable.js`, extend: "chart.grid.core", 190 lines, plus its own two
// `jui.define`-registered sort-strategy helper modules, "chart.topology.sort.random" and
// "chart.topology.sort.linear") has NOT been ported to `jui-graph-ts` at all - confirmed by
// searching `jui-graph-ts/src/grid/` for any "topolog*" file (none exist). Its `scale(index)`
// closure is genuinely load-bearing here: it accepts EITHER a numeric row index OR a string `key`
// (`getDataIndex(key)` in the legacy grid file resolves a key to an index first), returns
// `{x, y, scale}` (a real per-node zoom/pan-aware position, backed by `axis.cacheXY`/`axis.cache`
// state), and exposes `setX`/`setY`/`setScale`/`setView`/`moveLast` mutator closures that the
// (separately out-of-scope-for-this-batch) `topologyctrl` WIDGET reads/writes for pan-and-zoom
// interaction - a real coupling between this brush, this missing grid, and that still-unported
// widget. The existing "panel" grid (`jui-graph-ts/src/grid/panel.ts`) is structurally
// INCOMPATIBLE as a stand-in: its own `scale(i)` ignores its argument entirely and always returns
// the full `{x, y, width, height}` axis-area rect (no per-node position, no `.scale` field, no
// string-key lookup, no mutator closures) - substituting it would not produce a faithful chart, it
// would produce a visibly broken one (every node stacked at the same point). Per this project's
// standing rule ("if a jui-graph-ts gap is found, STOP and flag it rather than deciding"), this
// brush class itself is still ported here in full (the actual Batch 4 deliverable - brush
// registration), but no working demo/Playwright screenshot could be built for it: doing so would
// require either porting `chart.grid.topologytable` into `jui-graph-ts` (a new grid class, plus its
// two sort-strategy submodules) or misrepresenting the brush's real rendered output with an
// incompatible grid, neither of which this task is authorized to do unilaterally.
//
// **`chart.topology.edge`/`chart.topology.edgemanager` - literal small ported classes**, kept in
// this same file (unlike `treemap.js`'s `NodeManager`, nothing else in this batch shares them, so
// no separate module was warranted).
import { CoreBrush, registerBrush, mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** Literal port of legacy `chart.topology.edge`'s `TopologyEdge` constructor - a plain
 * getter/setter bag over 5 private fields, exactly as the original's own `get(type)`/`set(type,
 * value)` string-keyed dispatch shape (not restructured into real property accessors, to keep the
 * exact same call surface `topologynode.js` itself uses: `edge.get("in_xy")`, `edge.set("scale",
 * x)`, etc). */
class TopologyEdge {
  private start: string
  private end: string
  private in_xy: { x: number; y: number; angle: number; distance: number }
  private out_xy: { x: number; y: number; angle: number; distance: number }
  private scale: number
  private connected = false
  private elem: any = null

  constructor(start: string, end: string, in_xy: { x: number; y: number; angle: number; distance: number }, out_xy: { x: number; y: number; angle: number; distance: number }, scale: number) {
    this.start = start
    this.end = end
    this.in_xy = in_xy
    this.out_xy = out_xy
    this.scale = scale
  }

  key(): string {
    return this.start + ':' + this.end
  }

  reverseKey(): string {
    return this.end + ':' + this.start
  }

  connect(is?: boolean): boolean | void {
    if (arguments.length === 0) {
      return this.connected
    }

    this.connected = is as boolean
  }

  element(elem?: any): any {
    if (arguments.length === 0) {
      return this.elem
    }

    this.elem = elem
  }

  set(type: 'start' | 'end' | 'in_xy' | 'out_xy' | 'scale', value: any): void {
    if (type === 'start') this.start = value
    else if (type === 'end') this.end = value
    else if (type === 'in_xy') this.in_xy = value
    else if (type === 'out_xy') this.out_xy = value
    else if (type === 'scale') this.scale = value
  }

  get(type: 'start' | 'end' | 'in_xy' | 'out_xy' | 'scale'): any {
    if (type === 'start') return this.start
    else if (type === 'end') return this.end
    else if (type === 'in_xy') return this.in_xy
    else if (type === 'out_xy') return this.out_xy
    else if (type === 'scale') return this.scale
  }
}

/** Literal port of legacy `chart.topology.edgemanager`'s `TopologyEdgeManager` constructor. */
class TopologyEdgeManager {
  private list_: TopologyEdge[] = []
  private cache: Record<string, TopologyEdge> = {}

  add(edge: TopologyEdge): void {
    this.cache[edge.key()] = edge
    this.list_.push(edge)
  }

  get(key: string): TopologyEdge | undefined {
    return this.cache[key]
  }

  is(key: string): boolean {
    return !!this.cache[key]
  }

  list(): TopologyEdge[] {
    return this.list_
  }

  each(callback: (edge: TopologyEdge) => void): void {
    if (typeof callback !== 'function') return

    for (let i = 0; i < this.list_.length; i++) {
      callback.call(this, this.list_[i])
    }
  }
}

/** Literal port of `_.inArray(target, list)` (jui-core's small `indexOf`-with-a-null-guard
 * helper) - not exported from `jui-graph-ts`, so ported inline here (same "trivial generic array
 * util gets a local port, not treated as an engine gap" precedent `arcequalizer.ts`'s
 * `polarToCartesian` set). */
function inArray<T>(target: T, list: T[]): number {
  if (target == null || !Array.isArray(list)) return -1

  for (let i = 0; i < list.length; i++) {
    if (list[i] === target) return i
  }

  return -1
}

/** `chart.brush.topologynode`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface TopologyNodeBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `topologynode.js` defaults this to `true`, same as `BrushOptions`'s own default (kept
   * explicit for parity with the legacy source rather than omitted as redundant). */
  clip?: boolean
  /** Per-node title text, shown below the node (bold). No title when omitted/returns falsy. */
  nodeTitle?: ((this: unknown, data: BrushData) => unknown) | null
  /** Per-node body text, shown centered inside the node. No text when omitted/returns falsy. */
  nodeText?: ((this: unknown, data: BrushData) => unknown) | null
  /** Per-node image URL; when it returns a value, the node renders as an `<image>` instead of a
   * plain circle. */
  nodeImage?: ((this: unknown, data: BrushData) => unknown) | null
  /** Per-node radius multiplier applied on top of the theme's `topologyNodeRadius`. */
  nodeScale?: ((this: unknown, data: BrushData) => number) | null
  /** Extra per-edge records (keyed by `"<fromKey>:<toKey>"`) consulted for edge label text and
   * tooltip content - the row data itself only carries each node's own `outgoing` key list. */
  edgeData?: unknown[]
  /** Formats the label drawn along an edge; no label when omitted/returns nullish. Receives the
   * matching `edgeData` record and which end (`'start'`/`'end'`) the edge points toward. */
  edgeText?: ((this: unknown, data: unknown, align: string) => unknown) | null
  /** Per-edge opacity override on top of the theme's `topologyEdgeOpacity`. Receives the matching
   * `edgeData` record (or `null` when none exists for that edge). */
  edgeOpacity?: ((this: unknown, data: unknown) => number) | null
  /** Formats the bold title line of an edge's click tooltip. Required (together with
   * `tooltipText`) for the tooltip to render at all. */
  tooltipTitle?: ((this: unknown, data: unknown, align: string) => unknown) | null
  /** Formats the body line of an edge's click tooltip. Required (together with `tooltipTitle`)
   * for the tooltip to render at all. */
  tooltipText?: ((this: unknown, data: unknown, align: string) => unknown) | null
  /** Node `key` to highlight as active on initial render (re-render only, not the first mount -
   * see this brush's own `draw()`). */
  activeNode?: string | null
  /** Edge key (`"<fromKey>:<toKey>"`) to highlight as active, and its tooltip shown, on initial
   * render (re-render only, same caveat as `activeNode`). */
  activeEdge?: string | null
  /** DOM event name that activates a node/edge (highlight + `topology.nodeclick`/
   * `topology.edgeclick` emit) when it fires on that element. */
  activeEvent?: string
}

/** Own `chart.brush.topologynode.setup()` fields - see legacy `topologynode.js`. */
export const TOPOLOGYNODE_BRUSH_OWN_DEFAULTS: TopologyNodeBrushOptions = {
  clip: true,
  nodeTitle: null,
  nodeText: null,
  nodeImage: null,
  nodeScale: null,
  edgeData: [],
  edgeText: null,
  edgeOpacity: null,
  tooltipTitle: null,
  tooltipText: null,
  activeNode: null,
  activeEdge: null,
  activeEvent: 'click',
}

/** Shape `axis.c(index)` must satisfy for this brush - see this file's own header comment on why
 * the real required grid (`chart.grid.topologytable`) isn't ported yet. */
type TopologyScale = (index: number | string) => { x: number; y: number; scale: number }

export class TopologyNode extends CoreBrush {
  private edges = new TopologyEdgeManager()
  private g: any = null
  private tooltip: any = null
  private point = 0
  private readonly textY = 14
  private readonly padding = 7
  private readonly anchor = 7
  private activeEdges: TopologyEdge[] = []

  private getDistanceXY(x1: number, y1: number, x2: number, y2: number, dist?: number): { x: number; y: number; angle: number; distance: number } {
    const a = x1 - x2
    const b = y1 - y2
    const c = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
    const d = !dist ? 0 : dist
    const angle = mathUtil.angle(x1, y1, x2, y2)

    return {
      x: x1 + Math.cos(angle) * (c + d),
      y: y1 + Math.sin(angle) * (c + d),
      angle,
      distance: c,
    }
  }

  private getNodeData(key: unknown): BrushData | null {
    for (let i = 0; i < this.axis.data.length; i++) {
      const d = this.axis.data[i] as BrushData
      const k = this.getValue(d, 'key')

      if (k === key) {
        return d
      }
    }

    return null
  }

  private getEdgeData(key: string): Record<string, unknown> | null {
    const edgeData = (this.brush as Record<string, unknown>).edgeData as Record<string, unknown>[]

    for (let i = 0; i < edgeData.length; i++) {
      if (edgeData[i].key === key) {
        return edgeData[i]
      }
    }

    return null
  }

  private getTooltipData(edge: TopologyEdge): Record<string, unknown> | null {
    const edgeData = (this.brush as Record<string, unknown>).edgeData as Record<string, unknown>[]

    for (let j = 0; j < edgeData.length; j++) {
      if (edge.key() === edgeData[j].key) {
        return edgeData[j]
      }
    }

    return null
  }

  private getTooltipTitle(key: string): unknown {
    const names: unknown[] = []
    const keys = key.split(':')
    const nodeTitle = (this.brush as Record<string, unknown>).nodeTitle

    this.eachData((data: unknown) => {
      const d = data as BrushData
      const title = typeof nodeTitle === 'function' ? (nodeTitle as (this: unknown, data: BrushData) => unknown).call(this.chart, d) : ''

      if ((d as Record<string, unknown>).key === keys[0]) {
        names[0] = title || (d as Record<string, unknown>).key
      }

      if ((d as Record<string, unknown>).key === keys[1]) {
        names[1] = title || (d as Record<string, unknown>).key
      }
    })

    if (names.length > 0) return names
    return key
  }

  private getNodeRadius(data: BrushData | null): { r: number; scale: number } {
    let r = this.chart.theme('topologyNodeRadius') as number
    let scale = 1
    const nodeScale = (this.brush as Record<string, unknown>).nodeScale

    if (typeof nodeScale === 'function' && data) {
      scale = (nodeScale as (this: unknown, data: BrushData) => number).call(this.chart, data)
      r = r * scale
    }

    return { r, scale }
  }

  private getEdgeOpacity(data: unknown): number {
    let opacity = this.chart.theme('topologyEdgeOpacity') as number
    const edgeOpacity = (this.brush as Record<string, unknown>).edgeOpacity

    if (typeof edgeOpacity === 'function' && data) {
      opacity = (edgeOpacity as (this: unknown, data: unknown) => number).call(this.chart, data)
    }

    return opacity
  }

  private createNodes(index: number, data: BrushData): any {
    const brush = this.brush as Record<string, unknown>
    const key = this.getValue(data, 'key')
    const xy = (this.axis.c as unknown as TopologyScale)(index)
    const color = this.color(index, 0)
    const title = typeof brush.nodeTitle === 'function' ? (brush.nodeTitle as (this: unknown, data: BrushData) => unknown).call(this.chart, data) : ''
    const text = typeof brush.nodeText === 'function' ? (brush.nodeText as (this: unknown, data: BrushData) => unknown).call(this.chart, data) : ''
    const size = this.getNodeRadius(data)

    const node = this.svg
      .group({ index }, () => {
        if (typeof brush.nodeImage === 'function') {
          this.svg.image({
            'xlink:href': (brush.nodeImage as (this: unknown, data: BrushData) => unknown).call(this.chart, data),
            width: size.r * 2 * xy.scale,
            height: size.r * 2 * xy.scale,
            x: -size.r,
            y: -size.r,
            cursor: 'pointer',
          })
        } else {
          this.svg.circle({
            class: 'circle',
            r: size.r * xy.scale,
            fill: color,
            cursor: 'pointer',
          })
        }

        if (text && text !== '') {
          const fontSize = this.chart.theme('topologyNodeFontSize') as number

          this.chart.text(
            {
              class: 'text',
              x: 0.1 * xy.scale,
              y: (size.r / 2) * xy.scale,
              fill: this.chart.theme('topologyNodeFontColor'),
              'font-size': fontSize * size.scale * xy.scale,
              'text-anchor': 'middle',
              cursor: 'pointer',
            },
            text as string,
          )
        }

        if (title && title !== '') {
          this.chart.text(
            {
              class: 'title',
              x: 0.1 * xy.scale,
              y: (size.r + 13) * xy.scale,
              fill: this.chart.theme('topologyNodeTitleFontColor'),
              'font-size': (this.chart.theme('topologyNodeTitleFontSize') as number) * xy.scale,
              'font-weight': 'bold',
              'text-anchor': 'middle',
              cursor: 'pointer',
            },
            title as string,
          )
        }
      })
      .translate(xy.x, xy.y)

    node.on(brush.activeEvent, (e: unknown) => {
      this.onNodeActiveHandler(data)
      this.chart.emit('topology.nodeclick', [data, e])
    })

    if ((this.axis as unknown as { cache: Record<string, unknown> }).cache.nodeKey === key) {
      node.order = 1
    }

    this.addEvent(node, index, null as unknown as number)

    return node
  }

  private createEdges(): void {
    this.edges.each((edge) => {
      const in_xy = edge.get('in_xy')
      const out_xy = edge.get('out_xy')

      const node = this.svg.group()
      node.append(this.createEdgeLine(edge, in_xy, out_xy))
      node.append(this.createEdgeText(edge, in_xy, out_xy))

      this.g.append(node)
    })
  }

  private createEdgeLine(edge: TopologyEdge, in_xy: { x: number; y: number }, out_xy: { x: number; y: number }): any {
    const g = this.svg.group()
    const size = this.chart.theme('topologyEdgeWidth') as number
    const opacity = this.getEdgeOpacity(this.getEdgeData(edge.key()))

    if (!edge.connect()) {
      g.append(
        this.svg.line({
          cursor: 'pointer',
          x1: in_xy.x,
          y1: in_xy.y,
          x2: out_xy.x,
          y2: out_xy.y,
          stroke: this.chart.theme('topologyEdgeColor'),
          'stroke-width': size * edge.get('scale'),
          'stroke-opacity': opacity,
          'shape-rendering': 'geometricPrecision',
        }),
      )
    } else {
      const reverseElem = (this.edges.get(edge.reverseKey()) as TopologyEdge).element()

      reverseElem.get(0).attr({ 'stroke-opacity': opacity })
      reverseElem.get(1).attr({ 'fill-opacity': opacity })
    }

    g.append(
      this.svg.circle({
        fill: this.chart.theme('topologyEdgeColor'),
        'fill-opacity': opacity,
        stroke: this.chart.theme('backgroundColor'),
        'stroke-width': size * 2 * edge.get('scale'),
        r: this.point * edge.get('scale'),
        cx: out_xy.x,
        cy: out_xy.y,
      }),
    )

    g.on((this.brush as Record<string, unknown>).activeEvent, () => {
      this.onEdgeActiveHandler(edge)
    })

    g.on('mouseover', () => {
      this.onEdgeMouseOverHandler(edge)
    })

    g.on('mouseout', () => {
      this.onEdgeMouseOutHandler(edge)
    })

    edge.element(g)

    return g
  }

  private createEdgeText(edge: TopologyEdge, in_xy: { x: number; y: number; angle: number }, out_xy: { x: number; y: number; angle: number }): any {
    let text: any = null
    const edgeAlign = out_xy.x > in_xy.x ? 'end' : 'start'
    const edgeData = this.getEdgeData(edge.key())
    const brush = this.brush as Record<string, unknown>

    if (edgeData != null) {
      const edgeText = typeof brush.edgeText === 'function' ? (brush.edgeText as (this: unknown, data: unknown, align: string) => unknown).call(this.chart, edgeData, edgeAlign) : null

      if (edgeText != null) {
        if (edgeAlign === 'end') {
          text = this.svg
            .text(
              {
                x: out_xy.x - 9,
                y: out_xy.y + 13,
                cursor: 'pointer',
                fill: this.chart.theme('topologyEdgeFontColor'),
                'font-size': (this.chart.theme('topologyEdgeFontSize') as number) * edge.get('scale'),
                'text-anchor': edgeAlign,
              },
              edgeText as string,
            )
            .rotate(mathUtil.degree(out_xy.angle), out_xy.x, out_xy.y)
        } else {
          text = this.svg
            .text(
              {
                x: out_xy.x + 8,
                y: out_xy.y - 7,
                cursor: 'pointer',
                fill: this.chart.theme('topologyEdgeFontColor'),
                'font-size': (this.chart.theme('topologyEdgeFontSize') as number) * edge.get('scale'),
                'text-anchor': edgeAlign,
              },
              edgeText as string,
            )
            .rotate(mathUtil.degree(in_xy.angle), out_xy.x, out_xy.y)
        }

        text.on(brush.activeEvent, () => {
          this.onEdgeActiveHandler(edge)
        })

        text.on('mouseover', () => {
          this.onEdgeMouseOverHandler(edge)
        })

        text.on('mouseout', () => {
          this.onEdgeMouseOutHandler(edge)
        })
      }
    }

    return text
  }

  private setDataEdges(index: number, targetIndex: number): void {
    const data = this.getData(index)
    const key = this.getValue(data, 'key')
    const targetKey = (this.getValue(data, 'outgoing', []) as unknown[])[targetIndex]

    if (key === targetKey) return

    const targetData = this.getNodeData(targetKey)
    const target = (this.axis.c as unknown as TopologyScale)(targetKey as string)
    const xy = (this.axis.c as unknown as TopologyScale)(index)
    const in_dist = (this.getNodeRadius(data).r + this.point + 1) * xy.scale
    const out_dist = (this.getNodeRadius(targetData).r + this.point + 1) * xy.scale
    const in_xy = this.getDistanceXY(target.x, target.y, xy.x, xy.y, -in_dist)
    const out_xy = this.getDistanceXY(xy.x, xy.y, target.x, target.y, -out_dist)
    const edge = new TopologyEdge(key as string, targetKey as string, in_xy, out_xy, xy.scale)

    if (this.edges.is(edge.reverseKey())) {
      edge.connect(true)
    }

    this.edges.add(edge)
  }

  private showTooltip(edge: TopologyEdge, e?: unknown): void {
    const brush = this.brush as Record<string, unknown>
    if (typeof brush.tooltipTitle !== 'function' || typeof brush.tooltipText !== 'function') return

    const rect = this.tooltip.get(0)
    const text = this.tooltip.get(1)

    rect.attr({ points: '' })
    text.element.textContent = ''

    const edge_data = this.getTooltipData(edge)
    const in_xy = edge.get('in_xy')
    const out_xy = edge.get('out_xy')
    const align = out_xy.x > in_xy.x ? 'end' : 'start'

    this.chart.emit('topology.edgeclick', [edge_data, e])

    if (edge_data != null) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      const contents = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      const y = this.padding * 2 + (align === 'end' ? this.anchor : 0)

      text.element.appendChild(title)
      text.element.appendChild(contents)

      title.setAttribute('x', String(this.padding))
      title.setAttribute('y', String(y))
      title.setAttribute('font-weight', 'bold')
      title.textContent = (brush.tooltipTitle as (this: unknown, data: unknown, align: string) => unknown).call(this.chart, this.getTooltipTitle((edge_data as Record<string, unknown>).key as string), align) as string

      contents.setAttribute('x', String(this.padding))
      contents.setAttribute('y', String(y + this.textY + this.padding / 2))
      contents.textContent = (brush.tooltipText as (this: unknown, data: unknown, align: string) => unknown).call(this.chart, edge_data, align) as string

      const size = text.size()
      const w = size.width + this.padding * 2
      const h = size.height + this.padding * 2
      const x = out_xy.x - w / 2 + this.anchor / 2 + this.point / 2

      text.attr({ x: w / 2 })
      rect.attr({ points: this.balloonPoints(align === 'end' ? 'bottom' : 'top', w, h, this.anchor) })
      this.tooltip.attr({ visibility: 'visible' })

      if (align === 'end') {
        this.tooltip.translate(x, out_xy.y + this.anchor / 2 + this.point)
      } else {
        this.tooltip.translate(x, out_xy.y - this.anchor - h + this.point)
      }
    }
  }

  private onNodeActiveHandler(data: BrushData): void {
    const color = this.chart.theme('topologyEdgeColor')
    const activeColor = this.chart.theme('topologyActiveEdgeColor')
    const size = this.chart.theme('topologyEdgeWidth') as number
    const activeSize = this.chart.theme('topologyActiveEdgeWidth') as number
    const outgoing = (data as Record<string, unknown>).outgoing as unknown[]

    this.activeEdges = []
    for (let i = 0; i < outgoing.length; i++) {
      const key = (data as Record<string, unknown>).key + ':' + outgoing[i]
      const edge = this.edges.get(key)

      if (edge != null) {
        this.activeEdges.push(edge)
        if (edge.connect()) {
          this.activeEdges.push(this.edges.get(edge.reverseKey()) as TopologyEdge)
        }
      }
    }

    this.edges.each((edge) => {
      const elem = edge.element()
      const circle = elem.children.length === 2 ? elem.get(1) : elem.get(0)
      const line = elem.children.length === 2 ? elem.get(0) : null

      if (inArray(edge, this.activeEdges) !== -1) {
        const lineAttr = { stroke: activeColor, 'stroke-width': activeSize * edge.get('scale') }
        const circleAttr = { fill: activeColor }

        if (line != null) {
          line.attr(lineAttr)
        }
        circle.attr(circleAttr)

        this.tooltip.attr({ visibility: 'hidden' })
      } else {
        if (line != null) {
          line.attr({ stroke: color, 'stroke-width': size * edge.get('scale') })
        }
        circle.attr({ fill: color })
      }
    })
  }

  private onEdgeActiveHandler(edge: TopologyEdge | null): void {
    this.edges.each((newEdge) => {
      const elem = newEdge.element()
      const circle = elem.children.length === 2 ? elem.get(1) : elem.get(0)
      const line = elem.children.length === 2 ? elem.get(0) : null
      const color = this.chart.theme('topologyEdgeColor')
      const activeColor = this.chart.theme('topologyActiveEdgeColor')
      const size = this.chart.theme('topologyEdgeWidth') as number
      const activeSize = this.chart.theme('topologyActiveEdgeWidth') as number

      if (edge != null && (edge.key() === newEdge.key() || edge.reverseKey() === newEdge.key())) {
        if (line != null) {
          line.attr({ stroke: activeColor, 'stroke-width': activeSize * newEdge.get('scale') })
        }
        circle.attr({ fill: activeColor })

        if (edge.key() === newEdge.key()) {
          this.showTooltip(edge)
        }

        this.activeEdges = [edge]
        if (edge.connect()) {
          this.activeEdges.push(this.edges.get(edge.reverseKey()) as TopologyEdge)
        }
      } else {
        if (line != null) {
          line.attr({ stroke: color, 'stroke-width': size * newEdge.get('scale') })
        }
        circle.attr({ fill: color })
      }
    })
  }

  private onEdgeMouseOverHandler(edge: TopologyEdge): void {
    if (inArray(edge, this.activeEdges) !== -1) return

    const elem = edge.element()
    const circle = elem.children.length === 2 ? elem.get(1) : elem.get(0)
    const line = elem.children.length === 2 ? elem.get(0) : null
    const color = this.chart.theme('topologyHoverEdgeColor')
    const size = this.chart.theme('topologyHoverEdgeWidth') as number

    if (line != null) {
      line.attr({ stroke: color, 'stroke-width': size * edge.get('scale') })
    }

    circle.attr({ fill: color })
  }

  private onEdgeMouseOutHandler(edge: TopologyEdge): void {
    if (inArray(edge, this.activeEdges) !== -1) return

    const elem = edge.element()
    const circle = elem.children.length === 2 ? elem.get(1) : elem.get(0)
    const line = elem.children.length === 2 ? elem.get(0) : null
    const color = this.chart.theme('topologyEdgeColor')
    const size = this.chart.theme('topologyEdgeWidth') as number

    if (line != null) {
      line.attr({ stroke: color, 'stroke-width': size * edge.get('scale') })
    }

    circle.attr({ fill: color })
  }

  drawBefore = (): void => {
    this.g = this.svg.group()
    this.point = this.chart.theme('topologyEdgePointRadius') as number

    this.tooltip = this.svg.group({ visibility: 'hidden' }, () => {
      this.svg.polygon({
        fill: this.chart.theme('topologyTooltipBackgroundColor'),
        stroke: this.chart.theme('topologyTooltipBorderColor'),
        'stroke-width': 1,
      })

      this.chart.text({
        'font-size': this.chart.theme('topologyTooltipFontSize'),
        fill: this.chart.theme('topologyTooltipFontColor'),
        y: this.textY,
      })
    })
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>

    this.eachData((data: unknown, i: unknown) => {
      const d = data as BrushData
      const outgoing = (d as unknown as Record<string, unknown>).outgoing as unknown[]

      for (let j = 0; j < outgoing.length; j++) {
        this.setDataEdges(i as number, j)
      }
    })

    this.createEdges()

    this.eachData((data: unknown, i: unknown) => {
      const node = this.createNodes(i as number, data as BrushData)
      this.g.append(node)
    })

    this.on('axis.mousedown', (e: { target: unknown }) => {
      if ((this.axis.root as unknown as { element: unknown }).element === e.target) {
        this.onEdgeActiveHandler(null)
        this.tooltip.attr({ visibility: 'hidden' })
      }
    })

    if (typeof brush.activeEdge === 'string') {
      this.on('render', (init: boolean) => {
        if (!init) {
          const edge = this.edges.get(brush.activeEdge as string)
          this.onEdgeActiveHandler(edge ?? null)
        }
      })
    }

    if (typeof brush.activeNode === 'string') {
      this.on('render', (init: boolean) => {
        if (!init) {
          this.onNodeActiveHandler(this.getNodeData(brush.activeNode) as BrushData)
        }
      })
    }

    return this.g
  }

  static setup(): Record<string, unknown> {
    return TOPOLOGYNODE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('topologynode', TopologyNode)
