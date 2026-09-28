// Port of legacy `src/brush/treemap.js` ("chart.brush.treemap", extend: "chart.brush.core") -
// extends `CoreBrush` directly. Renders a squarified treemap: each row's `index` field is a
// dot-separated tree path ("0", "0.1", "0.1.2", ...) fed into a shared `NodeManager` (see
// `treemap-shared.ts`'s own header comment for why it's a separate module - `flame.js` reuses the
// SAME class via the original engine's string registry).
//
// **The nested-grouping/layout algorithm - re-derived from `convertNodeToArray()` +
// `treemapMultidimensional()`, cross-checked in full against `main` branch's `useTreemap.ts`
// header comment (which independently reverse-engineered the exact same behavior in far more
// detail than reproduced here)**: `convertNodeToArray(key, nodeList, result)` walks the tree and
// always produces a flat, exactly-2-levels-deep `unknown[][]` - each LEAF sibling's value is
// pushed into one shared running array for that level ("now" in source), and each NON-LEAF
// sibling instead triggers an immediate recursive call whose OWN flattened leaf-descendant array
// is pushed as a separate sibling entry in the SAME shared `result` list (not nested inside "now")
// - and the running "now" array for that level is only pushed to `result` at the very end of that
// level's loop. Since `treemapMultidimensional()` (in `treemap-shared.ts`) only ever checks ONE
// level of `data[0]` array-ness, this flat shape means the real recursion is always exactly 2
// squarify passes deep in practice, regardless of the source tree's real depth: one outer squarify
// of each group's value-SUM (one rectangle per group), then one inner squarify of each group's own
// raw leaf values within that group's rectangle.
//
// **A real, confirmed-by-hand-trace quirk this preserves, not fixes** (same finding `main`'s
// `useTreemap.ts` documents): a chain of single-child non-leaf ancestors is geometrically harmless,
// but siblings THREE OR MORE levels apart that are NOT part of a simple chain lose their
// intermediate grouping boundary entirely - all their leaf descendants effectively get squarified
// together as one flat run relative to their nearest leaf-bearing ancestor. This only matters for
// trees deeper than the common 2-level (category -> leaf) shape. Ported here as literal recursive
// tree functions (`convertNodeToArray`/`mergeArrayToNode`), not `main`'s algebraically-reduced
// 2-pass rewrite, per this project's "literal line-by-line port of the legacy file" rule.
//
// **Rendering-relevant fact confirmed from `mergeArrayToNode()`/`isDrawNode()`**: only LEAF nodes
// ever receive real `x`/`y`/`width`/`height` (`mergeArrayToNode`'s recursive walk only assigns
// geometry to non-array index entries, which are always leaves); every non-leaf node keeps its
// `drawBefore()`-time default geometry (`0,0,0,0` - see `TreemapNodeData`'s constructor defaults
// below), and `isDrawNode()` explicitly skips drawing any node whose x/y/width/height are ALL
// zero - i.e. non-leaf nodes are NEVER drawn as rectangles, only used as invisible grouping
// containers (and, per `titleDepth`, a title label via `createTitleDepth()`).
//
// **`getMinimumXY()` does NOT compute a true bounding-box minimum** - confirmed by reading it in
// full: it only ever descends into `node.children[0]` (the `for` loop's `return` on its first
// iteration means every iteration after the first is dead code), so a title label's position is
// always derived from the FIRST child's first-leaf-descendant corner, not a real minimum over all
// descendants - preserved literally, not "fixed" into an actual min-over-all-children scan.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { NodeManager, treemapMultidimensional, type TreemapNode } from './treemap-shared'

const TEXT_MARGIN_LEFT = 3

/** `chart.brush.treemap`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface TreemapBrushOptions {
  /** Vertical position of a leaf node's own text within its rectangle. */
  textOrient?: 'top' | 'center' | 'bottom'
  /** Horizontal alignment of a leaf node's own text within its rectangle. */
  textAlign?: 'start' | 'middle' | 'end'
  /** Draws each leaf node's own text (its `titleDepth`-depth group title, if any, is controlled
   * separately and always shown). */
  showText?: boolean
  /** Tree depth (root's children are depth 1) whose nodes get a group title label instead of - or
   * in addition to, per node - a leaf's own text. */
  titleDepth?: number
  /** Per-node fill color override; return value is passed straight through to `chart.color()`
   * (index, color string, or array - see this class's own `draw()` for the exact pass-through). */
  nodeColor?: ((this: unknown, node: TreemapNode) => unknown) | null
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `treemap.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** Formats a node's displayed text (both its own leaf text and any `titleDepth` group title);
   * the node's raw `text` field is used verbatim when omitted. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.treemap.setup()` fields - see legacy `treemap.js`. */
export const TREEMAP_BRUSH_OWN_DEFAULTS: TreemapBrushOptions = {
  textOrient: 'top',
  textAlign: 'middle',
  showText: true,
  titleDepth: 1,
  nodeColor: null,
  clip: false,
  format: null,
}

/** **PRESERVED QUIRK, literal port of `getMinimumXY()`** - see this file's own header comment: the
 * `for` loop's unconditional `return` on its first pass means only `node.children[0]` is ever
 * actually visited, not a real scan of every child. */
function treemapTitleAnchor(node: TreemapNode, dx: number, dy: number): { x: number; y: number } {
  if (node.children.length === 0) {
    return { x: Math.min(dx, node.x as number), y: Math.min(dy, node.y as number) }
  } else {
    for (let i = 0; i < node.children.length; i++) {
      return treemapTitleAnchor(node.children[i], dx, dy)
    }
  }
  // Unreachable in practice (the loop above always returns on iteration 0 when children.length >
  // 0) - TypeScript still requires an exhaustive return.
  return { x: dx, y: dy }
}

/** Literal port of `convertNodeToArray(key, nodes, result, now)`. */
function convertNodeToArray(key: 'value' | 'index', nodes: TreemapNode[], result: unknown[], now?: unknown[]): unknown[] {
  if (!now) now = []

  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].children.length === 0) {
      now.push(nodes[i][key])
    } else {
      convertNodeToArray(key, nodes[i].children, result, [])
    }
  }

  result.push(now)
  return result
}

/** Literal port of `mergeArrayToNode(keys, values)`. */
function mergeArrayToNode(nodes: NodeManager, keys: unknown[], values: unknown[]): void {
  for (let i = 0; i < keys.length; i++) {
    if (Array.isArray(keys[i])) {
      mergeArrayToNode(nodes, keys[i] as unknown[], values[i] as unknown[])
    } else {
      const node = nodes.getNode(keys[i] as string) as TreemapNode
      const rect = values[i] as [number, number, number, number]
      node.x = rect[0]
      node.y = rect[1]
      node.width = rect[2] - rect[0]
      node.height = rect[3] - rect[1]
    }
  }
}

function isDrawNode(node: TreemapNode): boolean {
  if (node.width === 0 && node.height === 0 && node.x === 0 && node.y === 0) {
    return false
  }

  return true
}

/** Literal port of `getRootNodeSeq(node)` - walks up to the top-level (depth-1) ancestor (whose
 * own parent is the synthetic, always-depth-0 tree root) and returns ITS `nodenum` (its position
 * among all top-level siblings) - used as the color-cycling key so every node in the same
 * top-level group shares one color. */
function getRootNodeSeq(node: TreemapNode): number {
  if ((node.parent as TreemapNode).depth > 0) {
    return getRootNodeSeq(node.parent as TreemapNode)
  }

  return node.nodenum as number
}

export class TreemapBrush extends CoreBrush {
  private nodes = new NodeManager()
  private titleKeys: Record<string, boolean> = {}

  private createTitleDepth(g: any, node: TreemapNode, sx: number, sy: number): void {
    const fontSize = this.chart.theme('treemapTitleFontSize')
    const w = this.axis.area('width')
    const h = this.axis.area('height')
    const xy = treemapTitleAnchor(node, w, h)

    const format = (this.brush as Record<string, unknown>).format

    const text = this.chart.text(
      {
        'font-size': fontSize,
        'font-weight': 'bold',
        fill: this.chart.theme('treemapTitleFontColor'),
        x: sx + xy.x + TEXT_MARGIN_LEFT,
        y: sy + xy.y + (fontSize as number),
        'text-anchor': 'start',
      },
      typeof format === 'function' ? (this.format(node) as string) : (node.text as string),
    )

    g.append(text)
    this.titleKeys[node.index as string] = true
  }

  drawBefore = (): void => {
    for (let i = 0; i < this.axis.data.length; i++) {
      const d = this.axis.data[i] as BrushData
      const k = this.getValue(d, 'index') as string

      this.nodes.insertNode(k, {
        text: this.getValue(d, 'text', ''),
        value: this.getValue(d, 'value', 0) as number,
        x: this.getValue(d, 'x', 0) as number,
        y: this.getValue(d, 'y', 0) as number,
        width: this.getValue(d, 'width', 0) as number,
        height: this.getValue(d, 'height', 0) as number,
      })
    }

    const nodeList = this.nodes.getNode() as TreemapNode[]
    const preData = convertNodeToArray('value', nodeList, [])
    const preKeys = convertNodeToArray('index', nodeList, [])
    const afterData = treemapMultidimensional(preData, this.axis.area('width'), this.axis.area('height'))

    mergeArrayToNode(this.nodes, preKeys, afterData)
  }

  draw = (): any => {
    const g = this.svg.group()
    const sx = this.axis.area('x')
    const sy = this.axis.area('y')
    const nodeList = this.nodes.getNodeAll()
    const brush = this.brush as Record<string, unknown>

    for (let i = 0; i < nodeList.length; i++) {
      if (brush.titleDepth === nodeList[i].depth) {
        this.createTitleDepth(g, nodeList[i], sx, sy)
      }

      if (!isDrawNode(nodeList[i])) continue

      const x = sx + (nodeList[i].x as number)
      const y = sy + (nodeList[i].y as number)
      const w = nodeList[i].width as number
      const h = nodeList[i].height as number

      if (brush.showText && !this.titleKeys[nodeList[i].index as string]) {
        let cx = x + w / 2
        let cy = y + h / 2
        const fontSize = this.chart.theme('treemapTextFontSize') as number

        if (brush.textOrient === 'top') {
          cy = y + fontSize
        } else if (brush.textOrient === 'bottom') {
          cy = y + h - fontSize / 2
        }

        if (brush.textAlign === 'start') {
          cx = x + TEXT_MARGIN_LEFT
        } else if (brush.textAlign === 'end') {
          cx = x + w - TEXT_MARGIN_LEFT
        }

        const format = brush.format
        const text = this.chart.text(
          {
            'font-size': fontSize,
            fill: this.chart.theme('treemapTextFontColor'),
            x: cx,
            y: cy,
            'text-anchor': brush.textAlign,
          },
          typeof format === 'function' ? (this.format(nodeList[i]) as string) : (nodeList[i].text as string),
        )

        g.append(text)
      }

      const elem = this.svg.rect({
        stroke: this.chart.theme('treemapNodeBorderColor'),
        'stroke-width': this.chart.theme('treemapNodeBorderWidth'),
        x,
        y,
        width: w,
        height: h,
        fill: this.color(getRootNodeSeq(nodeList[i])),
      })

      if (typeof brush.nodeColor === 'function') {
        // `CoreBrush.color()`'s TS signature is `(key1?: number, key2?: number)`, matching its own
        // JSDoc ("브러쉬에서 사용될 컬러 Index" - a color INDEX), but the real untyped legacy engine
        // passes whatever `nodeColor()` returns straight through (often a raw color string, per
        // real demo usage) with no type check of its own - `chart.color()` (the Builder-level
        // method this ultimately forwards to) accepts strings/indices/arrays interchangeably.
        // Faithful pass-through cast, not a type-narrowing fix.
        const color = (brush.nodeColor as (this: unknown, node: TreemapNode) => unknown).call(this.chart, nodeList[i])
        elem.attr({ fill: this.color(color as unknown as number) })
      }

      this.addEvent(elem, nodeList[i] as unknown as BrushData)
      g.prepend(elem)
    }

    return g
  }

  static setup(): Record<string, unknown> {
    return TREEMAP_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('treemap', TreemapBrush)
