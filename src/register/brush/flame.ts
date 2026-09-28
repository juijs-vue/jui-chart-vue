// Port of legacy `src/brush/flame.js` ("chart.brush.flame", extend: "chart.brush.core") - extends
// `CoreBrush` directly. A flame-graph (call-stack profiler visualization): each row's `index`
// field is a dot-separated tree path fed into `chart.brush.treemap.nodemanager` - the SAME shared
// `NodeManager` class `treemap.js` itself defines (confirmed by reading the legacy file's own
// `jui.use(TreemapBrush); ... jui.include("chart.brush.treemap.nodemanager")` at its top - it
// never defines its own tree class), imported here from `./treemap-shared` (see that module's
// header comment on why it's split out as a real ES import shared between the two brushes).
//
// **Genuinely different data model from `treemap.js` despite sharing `NodeManager`**: `flame.js`'s
// own `draw()` unconditionally reads `nodes.getNode()[0]` as THE single root (`var root =
// nodes.getNode()[0]`) - a call-stack has exactly one root frame, so (unlike `treemap.js`, which
// treats `root.children` as potentially many top-level siblings) a flame graph with more than one
// top-level row silently ignores every sibling after the first. Cross-checked against `main`
// branch's `useFlame.ts` header comment, which independently reached the same conclusion (its own
// `buildFlameTree()` similarly assumes a single root and documents the same "more than one
// top-level row" simplification, though as a hard crash upstream vs. a silent no-op here for rows
// past the first - this port keeps the LITERAL legacy behavior: `getNode()[0]` simply never reads
// index [1], [2], etc., neither crashing nor erroring).
//
// **Recursive layout, literal `drawNodeAll()` port**: each node's box width is divided among its
// children proportional to `child.value / node.value`, either left-to-right (`nodeAlign: "start"`)
// or right-to-left (`nodeAlign: "end"`, the default) - height is a fixed `axis.area("height") /
// maxDepth` band per depth level, growing either up from the bottom (`nodeOrient: "bottom"`, the
// default) or down from the top.
//
// **`activeIndex` (drill-down) rebuild - literal `createFilteredNodes()`/`setCacheParents()`/
// `setCacheChildren()`/`sortingCacheNodes()`/`createIndexData()`/`createChildIndexData()` port**:
// selecting a node re-roots the tree at that node (ancestors become one degenerate parent chain
// carrying the active node's own `value`, i.e. now 100% of the visible width; descendants keep
// their real values/structure) - ported literally including its own quicksort-based reordering
// (`QuickSort`, ported below unchanged) and its (fresh, no-op-safe here) use of module-level shared
// mutable state (`newData` in the original module closure - kept as a private instance field here
// since each brush instance already gets a fresh module `component()` invocation upstream anyway,
// same "one Vue-owned instance per real class instance" mapping every other Batch used).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { NodeManager, type TreemapNode } from './treemap-shared'

const TEXT_MARGIN = 3

/** `chart.brush.flame`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface FlameBrushOptions {
  /** Maximum tree depth to render (rows deeper than this are clipped from the layout); `null`
   * renders every depth the data actually has. */
  maxDepth?: number | null
  /** Whether depth level 0 (the root frame) sits at the bottom of the plot area (growing upward)
   * or the top (growing downward). */
  nodeOrient?: 'bottom' | 'top'
  /** Whether each node's children are laid out left-to-right (`'start'`) or right-to-left
   * (`'end'`) within the parent's width. */
  nodeAlign?: 'start' | 'end'
  /** Text alignment of each node's label within its box. */
  textAlign?: 'start' | 'end' | 'center'
  /** Overrides a node's fill color as a function of the node itself; the theme palette is used
   * when `null`. */
  nodeColor?: ((this: unknown, node: TreemapNode) => unknown) | null
  /** Dot-separated tree path of the node currently drilled into (re-roots the visible tree at
   * that node); `null` shows the whole tree from the real root. */
  activeIndex?: string | null
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `flame.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** Formats the value shown in each node's label/tooltip; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.flame.setup()` fields - see legacy `flame.js`. */
export const FLAME_BRUSH_OWN_DEFAULTS: FlameBrushOptions = {
  maxDepth: null,
  nodeOrient: 'bottom',
  nodeAlign: 'end',
  textAlign: 'start',
  nodeColor: null,
  activeIndex: null,
  clip: false,
  format: null,
}

/** Literal port of legacy `flame.js`'s own module-scope `QuickSort` helper (an in-place,
 * randomized-pivot-free quicksort using a caller-supplied `compareFunc`). */
class QuickSort<T> {
  private array: T[]
  private compareFunc: ((a: T, b: T) => boolean) | null = null

  constructor(array: T[], isClone?: boolean) {
    this.array = isClone ? array.slice(0) : array
  }

  private swap(indexA: number, indexB: number): void {
    const temp = this.array[indexA]
    this.array[indexA] = this.array[indexB]
    this.array[indexB] = temp
  }

  private partition(pivot: number, left: number, right: number): number {
    let storeIndex = left
    const pivotValue = this.array[pivot]
    this.swap(pivot, right)

    for (let v = left; v < right; v++) {
      if (this.compareFunc!(this.array[v], pivotValue) || (!this.compareFunc!(pivotValue, this.array[v]) && v % 2 === 1)) {
        this.swap(v, storeIndex)
        storeIndex++
      }
    }

    this.swap(right, storeIndex)

    return storeIndex
  }

  setCompare(func: (a: T, b: T) => boolean): void {
    this.compareFunc = func
  }

  run(left?: number, right?: number): T[] {
    if (typeof left !== 'number') {
      left = 0
    }

    if (typeof right !== 'number') {
      right = this.array.length - 1
    }

    if (left < right) {
      const pivot = left + Math.ceil((right - left) * 0.5)
      const newPivot = this.partition(pivot, left, right)

      this.run(left, newPivot - 1)
      this.run(newPivot + 1, right)
    }

    return this.array
  }
}

/** A filtered/drill-down node, shaped like `createFilteredNodes()`'s own plain `{text, value, x,
 * y, width, height}` insert payload. */
interface FlameFilterRow {
  index: string
  text: unknown
  value: number
}

export class FlameBrush extends CoreBrush {
  private g: any = null
  private height = 0
  private maxHeight = 0
  private nodes = new NodeManager()
  private disableOpacity = 1
  private newData: TreemapNode[] = []
  private activeDepth: number | null = null

  private getNodeAndTextOpacity(depth: number): number {
    return this.activeDepth == null ? 1 : depth < this.activeDepth ? this.disableOpacity : 1
  }

  private createNodeElement(node: TreemapNode, color: unknown): any {
    const newColor = this.chart.color(color as string | number)

    const r = this.svg.rect({
      fill: newColor,
      'fill-opacity': this.getNodeAndTextOpacity(node.depth),
      stroke: this.chart.theme('flameNodeBorderColor'),
      'stroke-width': this.chart.theme('flameNodeBorderWidth'),
      width: node.width,
      height: node.height,
      x: node.x,
      y: node.y,
      cursor: 'pointer',
    })

    r.hover(
      () => {
        r.attr({ stroke: newColor })
      },
      () => {
        r.attr({ stroke: this.chart.theme('flameNodeBorderColor') })
      },
    )

    this.addEvent(r, node as unknown as BrushData)

    ;(node as unknown as { element: { rect: any; text?: any } }).element = { rect: r }

    return r
  }

  private createTextElement(node: TreemapNode, color: unknown): any {
    const format = (this.brush as Record<string, unknown>).format
    if (typeof format !== 'function') {
      return null
    }

    const newColor = this.chart.color(color as string | number)
    const fontSize = this.chart.theme('flameTextFontSize') as number
    let startX = node.x as number

    const textAlign = (this.brush as Record<string, unknown>).textAlign
    if (textAlign === 'middle') {
      startX += (node.width as number) / 2
    } else if (textAlign === 'end') {
      startX += (node.width as number) - TEXT_MARGIN
    } else {
      startX += TEXT_MARGIN
    }

    const t = this.chart.text(
      {
        'font-size': fontSize,
        'font-weight': 'bold',
        fill: this.chart.theme('flameTextFontColor'),
        'fill-opacity': this.getNodeAndTextOpacity(node.depth),
        x: startX,
        y: (node.y as number) + fontSize / 3 + this.height / 2,
        'text-anchor': textAlign,
        cursor: 'pointer',
      },
      this.format(node) as string,
    )

    t.hover(
      () => {
        ;(node as unknown as { element: { rect: any } }).element.rect.attr({ stroke: newColor })
      },
      () => {
        ;(node as unknown as { element: { rect: any } }).element.rect.attr({ stroke: this.chart.theme('flameNodeBorderColor') })
      },
    )

    this.addEvent(t, node as unknown as BrushData)

    ;(node as unknown as { element: { text: any } }).element.text = t

    return t
  }

  private drawNodeAll(g: any, node: TreemapNode, width: number, sx: number): void {
    let color: unknown = this.color(0)

    node.width = width
    node.height = this.height
    node.x = sx

    const brush = this.brush as Record<string, unknown>

    if (brush.nodeOrient === 'bottom') {
      node.y = this.maxHeight - this.height * node.depth
    } else {
      node.y = this.height * node.depth
    }

    if (typeof brush.nodeColor === 'function') {
      color = (brush.nodeColor as (this: unknown, node: TreemapNode) => unknown).call(this.chart, node)
    }

    const r = this.createNodeElement(node, color)
    const t = this.createTextElement(node, color)

    if (brush.nodeAlign === 'start') {
      let cStartX = node.x as number

      for (let i = 0; i < node.children.length; i++) {
        const cNode = node.children[i]
        const cRate = (cNode.value as number) / (node.value as number)
        const cWidth = (node.width as number) * cRate

        this.drawNodeAll(g, cNode, cWidth, cStartX)
        cStartX += cWidth
      }
    } else {
      let cStartX = (node.x as number) + (node.width as number)

      for (let i = node.children.length - 1; i >= 0; i--) {
        const cNode = node.children[i]
        const cRate = (cNode.value as number) / (node.value as number)
        const cWidth = (node.width as number) * cRate

        cStartX -= cWidth
        this.drawNodeAll(g, cNode, cWidth, cStartX)
      }
    }

    g.append(r)

    if (t != null) {
      g.append(t)
    }
  }

  private getMaxDepth(nodes: TreemapNode[]): number {
    let maxDepth = 0

    for (let i = 0; i < nodes.length; i++) {
      maxDepth = Math.max(maxDepth, nodes[i].depth)
    }

    return maxDepth
  }

  private setCacheParents(node: TreemapNode, value: number): void {
    if (node.depth > 0) {
      node.value = value
      this.newData.push(node)

      if (node.parent) {
        this.setCacheParents(node.parent, value)
      }
    }
  }

  private setCacheChildren(node: TreemapNode): void {
    for (let i = 0; i < node.children.length; i++) {
      const cNode = node.children[i]
      this.newData.push(cNode)

      if (cNode.children.length > 0) {
        this.setCacheChildren(cNode)
      }
    }
  }

  private sortingCacheNodes(): void {
    const qs = new QuickSort(this.newData)

    qs.setCompare((a, b) => a.depth < b.depth)

    qs.run()
  }

  private createChildIndexData(node: TreemapNode, index: string, result: FlameFilterRow[]): void {
    result.push({ index, value: node.value as number, text: node.text })

    for (let i = 0; i < node.children.length; i++) {
      const cNode = node.children[i]
      this.createChildIndexData(cNode, index + '.' + i, result)
    }
  }

  private createIndexData(node: TreemapNode): FlameFilterRow[] {
    const tmpData: FlameFilterRow[] = []
    let index = ''

    for (let i = 0; i < this.newData.length; i++) {
      if (index === '') {
        index = '0'
      } else {
        index += '.0'
      }

      if (this.newData[i].depth < node.depth) {
        tmpData.push({ index, text: this.newData[i].text, value: this.newData[i].value as number })
      } else {
        this.createChildIndexData(node, index, tmpData)
        break
      }
    }

    return tmpData
  }

  private createFilteredNodes(activeNode: TreemapNode): TreemapNode {
    // **PRESERVED QUIRK**: the legacy `newData` closure variable is never cleared anywhere in the
    // original module (declared once, only ever pushed onto by `setCacheParents`/
    // `setCacheChildren`) - so on a real chart where `activeIndex` changes and this whole method
    // re-runs on the SAME brush instance, entries from every PRIOR filter pass stay in `newData`
    // and get re-sorted/re-walked alongside the new ones. Not reset here either, for the same
    // reason: this project's standing rule is to keep a real, reachable upstream bug as a literal
    // bug, not silently patch it into "probably what was intended."
    this.setCacheParents(activeNode, activeNode.value as number)
    this.setCacheChildren(activeNode)
    this.sortingCacheNodes()

    const tmpData = this.createIndexData(activeNode)
    const tmpNodes = new NodeManager()

    for (let i = 0; i < tmpData.length; i++) {
      const d = tmpData[i]

      tmpNodes.insertNode(d.index, {
        text: '' + d.text,
        value: d.value,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      })
    }

    ;(this.axis as unknown as { cacheNodes: NodeManager }).cacheNodes = tmpNodes

    return (tmpNodes.getNode() as TreemapNode[])[0]
  }

  drawBefore = (): void => {
    this.g = this.svg.group()

    for (let i = 0; i < this.axis.data.length; i++) {
      const d = this.axis.data[i] as BrushData
      const k = this.getValue(d, 'index') as string

      this.nodes.insertNode(k, {
        text: '' + this.getValue(d, 'text', ''),
        value: this.getValue(d, 'value', 0) as number,
        x: this.getValue(d, 'x', 0) as number,
        y: this.getValue(d, 'y', 0) as number,
        width: this.getValue(d, 'width', 0) as number,
        height: this.getValue(d, 'height', 0) as number,
      })
    }

    const brush = this.brush as Record<string, unknown>
    const maxDepth = brush.maxDepth == null ? this.getMaxDepth(this.nodes.getNodeAll()) : (brush.maxDepth as number)
    this.height = this.axis.area('height') / maxDepth
    this.maxHeight = this.axis.area('height')

    this.disableOpacity = this.chart.theme('flameDisableBackgroundOpacity') as number
  }

  draw = (): any => {
    const area = this.axis.area()
    let root = (this.nodes.getNode() as TreemapNode[])[0]
    const activeIndex = (this.brush as Record<string, unknown>).activeIndex

    if (root) {
      if (typeof activeIndex === 'string') {
        let activeNode = this.nodes.getNode(activeIndex) as TreemapNode | null

        if (activeNode == null) {
          activeNode = (this.axis as unknown as { cacheNodes: NodeManager }).cacheNodes.getNode(activeIndex) as TreemapNode
        }

        root = this.createFilteredNodes(activeNode)
        this.activeDepth = activeNode.depth
      }

      this.drawNodeAll(this.g, root, area.width, area.x)
    }

    return this.g
  }

  static setup(): Record<string, unknown> {
    return FLAME_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('flame', FlameBrush)
