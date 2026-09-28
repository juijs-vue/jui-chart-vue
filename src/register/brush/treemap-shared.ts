// Shared tree/layout machinery from legacy `src/brush/treemap.js` (774 lines) - specifically its
// five `jui.define(...)`-registered helper modules ("util.keyparser", "util.treemap",
// "chart.brush.treemap.node", "chart.brush.treemap.nodemanager",
// "chart.brush.treemap.container"/"calculator"), split into their own module here because
// `flame.js` ALSO consumes `chart.brush.treemap.nodemanager` directly via
// `jui.include("chart.brush.treemap.nodemanager")` (after `jui.use(TreemapBrush)`) - i.e. the real
// engine shares ONE NodeManager class between the two brushes via its string registry. A real ES
// module (`treemap.ts` and `flame.ts` both `import` from here) is the literal equivalent of that
// shared-singleton-class registry lookup, per this project's "real import/export, not a runtime
// registry" rule - not a new abstraction invented for this port.
//
// **The squarify layout algorithm below (`Container`/`treemapMultidimensional`/`squarify`/
// `improvesRatio`/`calculateRatio`/etc.) is a LITERAL port of `treemap.js`'s OWN restructured
// copy**, not the external `imranghory/treemap-squared` library `main` branch's `useTreemap.ts`
// vendors. `main`'s own header comment (PORT_STATUS.md Phase F audit) independently confirms
// `treemap.js`'s `calculator`/`container` are "a restructured adaptation" of that external
// library - same algorithm family, but reorganized into jui-chart's own module shape, not
// byte-identical to the upstream file. This project's standing rule is a faithful line-by-line
// port of the legacy `src/brush/*.js` file itself, so this ports THAT restructured copy directly
// (function-for-function, matching every legacy name), rather than substituting the external
// vendored library `main` uses instead. `main`'s composables were still read in full and used as a
// cross-check of expected behavior/quirks (see `treemap.ts`'s own header comment).

// ---- "util.keyparser" -------------------------------------------------------------------------
/** Literal port of legacy `util.keyparser` (a `jui.define([], function() {...})` with no
 * dependencies) - dot-separated tree index string helpers ("0.1.2" etc). `changeIndex`/
 * `getNextIndex`/`getParentIndex` are ported for completeness (same shared-singleton-class
 * precedent as the rest of this file) even though neither `treemap.js` nor `flame.js` calls them
 * directly - only `isIndexDepth`/`getIndexList` are actually exercised by `NodeManager` below. */
export class KeyParser {
  /** Returns `true` when `index` is a dot-separated string (i.e. deeper than the root level, e.g.
   * `"0.1"` rather than a plain top-level number/numeric string like `"0"`). */
  isIndexDepth(index: unknown): boolean {
    return typeof index === 'string' && index.indexOf('.') !== -1
  }

  /** Splits a dot-separated index string (or coerces a plain number) into its numeric path
   * segments, e.g. `"0.1.2"` -> `[0, 1, 2]`. */
  getIndexList(index: unknown): number[] {
    const resIndex: number[] = []
    const strIndexes = ('' + index).split('.')

    for (let i = 0; i < strIndexes.length; i++) {
      resIndex[i] = parseInt(strIndexes[i], 10)
    }

    return resIndex
  }

  /** Rewrites `index` so its leading `rootIndex`-length path segments are replaced with
   * `targetIndex`'s own path, e.g. reparenting a subtree's index when it moves under a different
   * root. Not called by `treemap.js`/`flame.js` (ported for completeness, see class doc comment). */
  changeIndex(index: string, targetIndex: string, rootIndex: string): string {
    const rootIndexLen = this.getIndexList(rootIndex).length
    const indexList = this.getIndexList(index)
    const tIndexList = this.getIndexList(targetIndex)

    for (let i = 0; i < rootIndexLen; i++) {
      indexList.shift()
    }

    return (tIndexList as unknown[]).concat(indexList as unknown[]).join('.')
  }

  /** Returns `index` with its final path segment incremented by one, e.g. `"0.1"` -> `"0.2"`. Not
   * called by `treemap.js`/`flame.js` (ported for completeness, see class doc comment). */
  getNextIndex(index: string): string {
    const indexList = this.getIndexList(index)
    const no = (indexList.pop() as number) + 1

    indexList.push(no)
    return indexList.join('.')
  }

  /** Returns `index` with its final path segment dropped (the parent's own index), or `null` when
   * `index` is already at the root level (`isIndexDepth` is false). Not called by `treemap.js`/
   * `flame.js` (ported for completeness, see class doc comment). */
  getParentIndex(index: string): string | null {
    if (!this.isIndexDepth(index)) return null

    return index.substr(0, index.lastIndexOf('.'))
  }
}

// ---- "util.treemap" -----------------------------------------------------------------------------
/** Literal port of legacy `util.treemap`'s `sumArray` - a plain numeric array sum, used throughout
 * the squarify layout algorithm below. */
export function sumArray(arr: number[]): number {
  let sum = 0

  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
  }

  return sum
}

// ---- "chart.brush.treemap.node" ------------------------------------------------------------------
/** Plain constructor payload for `TreemapNode` - a node's own display/layout fields (`x`/`y`/
 * `width`/`height` are typically unset until the squarify layout pass fills them in). */
export interface TreemapNodeData {
  text?: unknown
  value?: number
  x?: number
  y?: number
  width?: number
  height?: number
}

/** Literal port of legacy `chart.brush.treemap.node`'s `Node` constructor. */
export class TreemapNode {
  text: unknown
  value: number | undefined
  x: number | undefined
  y: number | undefined
  width: number | undefined
  height: number | undefined

  /** @property {Integer} [index=null] Index of a specified node */
  index: string | null = null
  /** @property {Integer} [nodenum=null] Unique number of a specified node at the current depth */
  nodenum: number | null = null
  /** @property {ui.tree.node} [parent=null] */
  parent: TreemapNode | null = null
  /** @property {Array} [children=null] */
  children: TreemapNode[] = []
  /** @property {Integer} [depth=0] */
  depth = 0

  constructor(data: TreemapNodeData) {
    this.text = data.text
    this.value = data.value
    this.x = data.x
    this.y = data.y
    this.width = data.width
    this.height = data.height
  }

  /** **PRESERVED QUIRK**: a genuine no-op - recurses into every descendant that has children of
   * its own, but never actually mutates anything on the way. Confirmed by reading the legacy
   * `setIndexChild()` closure in full: its `if` body only ever recurses again, with no other
   * statement anywhere in the function. Vestigial dead code from the original engine itself, kept
   * as an equally-inert recursion here rather than silently dropped. */
  private setIndexChild(node: TreemapNode): void {
    const clist = node.children

    for (let i = 0; i < clist.length; i++) {
      if (clist[i].children.length > 0) {
        this.setIndexChild(clist[i])
      }
    }
  }

  /** Recomputes this node's `nodenum`/`index`/`depth` from its parent chain (a root-level node,
   * with no `parent`, keeps `index` unset and `depth` at its initial `0`), then recurses into
   * descendants via the no-op `setIndexChild` (see that method's own doc comment - this recursion
   * doesn't actually update any descendant's own `index`/`depth`, only this node's). */
  reload(nodenum?: number): void {
    this.nodenum = typeof nodenum === 'number' && !isNaN(nodenum) ? nodenum : this.nodenum

    if (this.parent) {
      if (this.parent.index == null) this.index = '' + this.nodenum
      else this.index = this.parent.index + '.' + this.nodenum
    }

    if (this.parent && typeof this.index === 'string') {
      this.depth = this.index.split('.').length
    }

    if (this.children.length > 0) {
      this.setIndexChild(this)
    }
  }

  /** Returns `true` when this node has no children. */
  isLeaf(): boolean {
    return this.children.length === 0
  }

  /** Appends `node` to the end of this node's `children` array. */
  appendChild(node: TreemapNode): void {
    this.children.push(node)
  }

  /** Inserts `node` at position `nodenum` within this node's `children` array, shifting later
   * children back. */
  insertChild(nodenum: number, node: TreemapNode): void {
    const preNodes = this.children.splice(0, nodenum)
    preNodes.push(node)

    this.children = preNodes.concat(this.children)
  }

  /** Removes the (at most one) direct child whose own `index` matches. A no-op when no child
   * matches. */
  removeChild(index: string | null): void {
    for (let i = 0; i < this.children.length; i++) {
      const node = this.children[i]

      if (node.index === index) {
        this.children.splice(i, 1)
      }
    }
  }

  /** Returns this node's last direct child, or `null` when it has none. */
  lastChild(): TreemapNode | null {
    if (this.children.length > 0) return this.children[this.children.length - 1]

    return null
  }

  /** Walks down the "last child" chain (starting from `lastRow`, or this node's own `lastChild()`
   * when omitted) until it reaches a leaf, returning that leaf - i.e. the last-added node in the
   * deepest, most-recently-appended branch. */
  lastChildLeaf(lastRow?: TreemapNode): TreemapNode {
    const row = !lastRow ? (this.lastChild() as TreemapNode) : lastRow

    if (row.isLeaf()) return row
    else {
      return this.lastChildLeaf(row.lastChild() as TreemapNode)
    }
  }
}

// ---- "chart.brush.treemap.nodemanager" -----------------------------------------------------------
/** Literal port of legacy `chart.brush.treemap.nodemanager`'s `NodeManager` constructor - shared,
 * as a real ES import, between `treemap.ts` and `flame.ts` (see this file's own header comment). */
export class NodeManager {
  private root = new TreemapNode({ text: null, value: -1, x: -1, y: -1, width: -1, height: -1 })
  private iParser = new KeyParser()

  /** Builds a new `TreemapNode` from `data`, wires its `parent` and calls `reload(no)` to derive
   * its `nodenum`/`index`/`depth` immediately. */
  private createNode(data: TreemapNodeData, no: number, pNode: TreemapNode | null): TreemapNode {
    const node = new TreemapNode(data)

    node.parent = pNode ? pNode : null
    node.reload(no)

    return node
  }

  /** Recursively appends every descendant of `node` (depth-first) into `dataList` - the flattening
   * helper behind `getNodeAll()`. */
  private setNodeChildAll(dataList: TreemapNode[], node: TreemapNode): void {
    const c_nodes = node.children

    if (c_nodes.length > 0) {
      for (let i = 0; i < c_nodes.length; i++) {
        dataList.push(c_nodes[i])

        if (c_nodes[i].children.length > 0) {
          this.setNodeChildAll(dataList, c_nodes[i])
        }
      }
    }
  }

  /** Walks down `node`'s children following the remaining `keys` path segments (consumed one per
   * recursive call via `keys.shift()`) until the path is exhausted, returning the node reached -
   * the multi-level index resolver behind `getNode()`. */
  private getNodeChildLeaf(keys: number[], node: TreemapNode | null): TreemapNode | null {
    if (!node) return null
    const tmpKey = keys.shift()

    if (tmpKey === undefined) {
      return node
    } else {
      return this.getNodeChildLeaf(keys, node.children[tmpKey])
    }
  }

  /** Builds a new node from `data` and inserts it as `index`'s own node into that index's parent
   * (`getNodeParent(index)`), at the position given by `index`'s final path segment. */
  private insertNodeDataChild(index: string, data: TreemapNodeData): TreemapNode {
    const keys = this.iParser.getIndexList(index)

    const pNode = this.getNodeParent(index) as TreemapNode
    const nodenum = keys[keys.length - 1]
    const node = this.createNode(data, nodenum, pNode)

    pNode.insertChild(nodenum, node)

    return node
  }

  /** Builds a new node from `data` and appends it as a new top-level child of the manager's
   * internal `root`. */
  private appendNodeData(data: TreemapNodeData): TreemapNode {
    const node = this.createNode(data, this.root.children.length, this.root)
    this.root.appendChild(node)

    return node
  }

  /** Builds a new node from `data` and appends it as a new child of the existing node at `index`. */
  private appendNodeDataChild(index: string, data: TreemapNodeData): TreemapNode {
    const pNode = this.getNode(index) as TreemapNode
    const cNode = this.createNode(data, pNode.children.length, pNode)

    pNode.appendChild(cNode)

    return cNode
  }

  /** Faithful to the original's `arguments.length`-based overload: `appendNode(data)` (1 arg)
   * appends `data` as a new top-level child; `appendNode(index, data)` (2 args) appends `data` as
   * a new child of the node at `index`. */
  appendNode(indexOrData: string | TreemapNodeData, data?: TreemapNodeData): TreemapNode {
    if (!data) {
      return this.appendNodeData(indexOrData as TreemapNodeData)
    } else {
      return this.appendNodeDataChild(indexOrData as string, data)
    }
  }

  insertNode(index: string, data: TreemapNodeData): TreemapNode {
    if (this.root.children.length === 0 && parseInt(index, 10) === 0) {
      // **PRESERVED QUIRK**: the original calls `this.appendNode(data)` here - passing the DATA
      // object (not `index`) as `appendNode`'s first argument. Since that call has only one
      // argument, `appendNode` takes its own single-arg branch (`appendNodeData`), so the literal
      // `index` value is discarded entirely on this path (harmless in practice: this branch only
      // ever fires for the very first inserted node, whose real index is always "0" anyway).
      return this.appendNode(data)
    } else {
      return this.insertNodeDataChild(index, data)
    }
  }

  /** **PRESERVED QUIRK, never called by `treemap.js`/`flame.js`**: `node.data` doesn't exist
   * anywhere in `TreemapNode` (fields are flat: `text`/`value`/`x`/`y`/`width`/`height`), so the
   * original's `node.data[key] = data[key]` throws a `TypeError` the instant this is ever called
   * with a non-empty `data` object - a latent, unreachable bug in the real upstream engine, kept
   * as a literal crash rather than silently "fixed" (same "faithful crash over silent patch"
   * principle applied throughout this project). The extra, always-inert second `reload()` argument
   * the original passes (`node.reload(node.nodenum, true)` - `reload()` only ever takes one
   * parameter) is simply not passed here, same as `grid/panel.ts`'s own precedent for dropping an
   * already-100%-inert extra argument. */
  updateNode(index: string, data: Record<string, unknown>): TreemapNode {
    const node = this.getNode(index) as TreemapNode

    for (const key in data) {
      ;(node as unknown as { data: Record<string, unknown> }).data[key] = data[key]
    }

    node.reload(node.nodenum ?? undefined)

    return node
  }

  /** Resolves `index` to a node: `null`/omitted returns every top-level child (`root.children`)
   * as an array; a dot-separated index walks the tree via `getNodeChildLeaf`; a plain top-level
   * index returns that direct child (or `null` if out of range). */
  getNode(index?: string | number | null): TreemapNode | TreemapNode[] | null {
    if (index == null) return this.root.children
    else {
      const nodes = this.root.children

      if (this.iParser.isIndexDepth(index)) {
        const keys = this.iParser.getIndexList(index)
        return this.getNodeChildLeaf(keys, nodes[keys.shift() as number])
      } else {
        return nodes[index as number] ? nodes[index as number] : null
      }
    }
  }

  /** Returns a flat array of `index`'s subtree (that node plus every descendant, depth-first via
   * `setNodeChildAll`), or the ENTIRE tree (every top-level child plus all their descendants) when
   * `index` is omitted/`null`. */
  getNodeAll(index?: string | number | null): TreemapNode[] {
    const dataList: TreemapNode[] = []
    const single = index == null ? null : (this.getNode(index) as TreemapNode | null)
    const tmpNodes: (TreemapNode | null)[] = index == null ? this.root.children : [single]

    for (let i = 0; i < tmpNodes.length; i++) {
      if (tmpNodes[i]) {
        dataList.push(tmpNodes[i] as TreemapNode)

        if ((tmpNodes[i] as TreemapNode).children.length > 0) {
          this.setNodeChildAll(dataList, tmpNodes[i] as TreemapNode)
        }
      }
    }

    return dataList
  }

  /** Resolves `index`'s parent node: the manager's internal `root` for a single-segment index, the
   * corresponding top-level node for a 2-segment index, or a recursive `getNode()` lookup on the
   * index with its final segment dropped for anything deeper. Returns `undefined` for a malformed
   * (empty-path) index. */
  getNodeParent(index: string): TreemapNode | undefined {
    const keys = this.iParser.getIndexList(index)

    if (keys.length === 1) {
      return this.root
    } else if (keys.length === 2) {
      return this.getNode(keys[0]) as TreemapNode
    } else if (keys.length > 2) {
      keys.pop()
      return this.getNode(keys.join('.')) as TreemapNode
    }
  }

  /** Returns the manager's internal, otherwise-inaccessible root node (whose own `text`/`value`/
   * position fields are just placeholder `-1`s - only its `children` are meaningful). */
  getRoot(): TreemapNode {
    return this.root
  }
}

// ---- "chart.brush.treemap.container" -------------------------------------------------------------
/** Literal port of legacy `chart.brush.treemap.container`'s `Container` constructor (the Bruls
 * squarify algorithm's own container-box bookkeeping). */
export class TreemapContainer {
  xoffset: number
  yoffset: number
  height: number
  width: number

  constructor(xoffset: number, yoffset: number, width: number, height: number) {
    this.xoffset = xoffset
    this.yoffset = yoffset
    this.height = height
    this.width = width
  }

  /** Returns whichever of this container's `width`/`height` is smaller - the squarify algorithm's
   * own "aim for aspect ratios close to this edge length" reference dimension. */
  shortestEdge(): number {
    return Math.min(this.height, this.width)
  }

  /** Lays out `row` (a group of already-decided box areas) as a strip along whichever of this
   * container's edges is longer: a horizontal strip of side-by-side columns when `width >=
   * height`, or a vertical strip of stacked rows otherwise. Returns each box's `[x1, y1, x2, y2]`
   * corners. */
  getCoordinates(row: number[]): [number, number, number, number][] {
    const coordinates: [number, number, number, number][] = []
    let subxoffset = this.xoffset
    let subyoffset = this.yoffset
    const areawidth = sumArray(row) / this.height
    const areaheight = sumArray(row) / this.width

    if (this.width >= this.height) {
      for (let i = 0; i < row.length; i++) {
        coordinates.push([subxoffset, subyoffset, subxoffset + areawidth, subyoffset + row[i] / areawidth])
        subyoffset = subyoffset + row[i] / areawidth
      }
    } else {
      for (let i = 0; i < row.length; i++) {
        coordinates.push([subxoffset, subyoffset, subxoffset + row[i] / areaheight, subyoffset + areaheight])
        subxoffset = subxoffset + row[i] / areaheight
      }
    }

    return coordinates
  }

  /** Returns a new, smaller `TreemapContainer` with `area` worth of space removed from whichever
   * edge is longer (matching `getCoordinates()`'s own orientation choice) - the remaining
   * rectangle the next squarify row lays out into. */
  cutArea(area: number): TreemapContainer {
    if (this.width >= this.height) {
      const areawidth = area / this.height
      const newwidth = this.width - areawidth

      return new TreemapContainer(this.xoffset + areawidth, this.yoffset, newwidth, this.height)
    } else {
      const areaheight = area / this.width
      const newheight = this.height - areaheight

      return new TreemapContainer(this.xoffset, this.yoffset + areaheight, this.width, newheight)
    }
  }
}

// ---- "chart.brush.treemap.calculator" ------------------------------------------------------------
/** Rescales `data` so its values sum to exactly `area` (preserving their relative proportions) -
 * the squarify algorithm's own pixel-area normalization step, run once before laying out a
 * single-dimensional data set. */
function normalize(data: number[], area: number): number[] {
  const normalizeddata: number[] = []
  const sum = sumArray(data)
  const multiplier = area / sum

  for (let i = 0; i < data.length; i++) {
    normalizeddata[i] = data[i] * multiplier
  }

  return normalizeddata
}

/** Recursively sums every leaf number in a (possibly nested) array - used to collapse each
 * top-level group of a multi-dimensional data set down to one number before the outer squarify
 * pass lays out the groups themselves. */
function sumMultidimensionalArray(arr: unknown[]): number {
  let total = 0

  if (Array.isArray(arr[0])) {
    for (let i = 0; i < arr.length; i++) {
      total += sumMultidimensionalArray(arr[i] as unknown[])
    }
  } else {
    total = sumArray(arr as number[])
  }

  return total
}

/** The Bruls squarify algorithm's worst-aspect-ratio metric for a candidate `row` of box areas
 * against a strip of the given `length` (the container's shortest edge) - the larger of "widest
 * box's ratio" and "narrowest box's ratio", so a lower result always means a row of boxes closer
 * to square. */
function calculateRatio(row: number[], length: number): number {
  const min = Math.min.apply(Math, row)
  const max = Math.max.apply(Math, row)
  const sum = sumArray(row)

  return Math.max((Math.pow(length, 2) * max) / Math.pow(sum, 2), Math.pow(sum, 2) / (Math.pow(length, 2) * min))
}

/** Decides whether adding `nextnode` to `currentrow` would keep (or improve) the row's aspect
 * ratio, or make it worse - an empty `currentrow` always accepts the first node. See this
 * function's own inline comment on the Bruls paper's own pseudocode having the comparison
 * direction backwards; this is the corrected direction. */
function improvesRatio(currentrow: number[], nextnode: number, length: number): boolean {
  if (currentrow.length === 0) {
    return true
  }

  const newrow = currentrow.slice()
  newrow.push(nextnode)

  const currentratio = calculateRatio(currentrow, length)
  const newratio = calculateRatio(newrow, length)

  // the pseudocode in the Bruls paper has the direction of the comparison
  // wrong, this is the correct one.
  return currentratio >= newratio
}

/** The squarify algorithm's own recursive core: greedily grows `currentrow` with successive
 * `data` values as long as `improvesRatio` says the row keeps improving, otherwise flushes the
 * accumulated row's coordinates into `stack` (via `container.getCoordinates()`), cuts that area
 * out of `container` (`cutArea()`), and starts a fresh row against the remaining space. Recurses
 * until `data` is exhausted, at which point the final row is flushed too. Mutates and returns
 * `stack`. */
function squarify(data: number[], currentrow: number[], container: TreemapContainer, stack: unknown[][]): unknown[][] | undefined {
  if (data.length === 0) {
    stack.push(container.getCoordinates(currentrow))
    return
  }

  const length = container.shortestEdge()
  const nextdatapoint = data[0]

  if (improvesRatio(currentrow, nextdatapoint, length)) {
    currentrow.push(nextdatapoint)
    squarify(data.slice(1), currentrow, container, stack)
  } else {
    const newcontainer = container.cutArea(sumArray(currentrow))
    stack.push(container.getCoordinates(currentrow))
    squarify(data, [], newcontainer, stack)
  }
  return stack
}

/** Flattens `squarify()`'s row-grouped stack of coordinate arrays into one flat list of box
 * corners, in the same order the rows were flushed. Returns an empty array when `rawtreemap` is
 * `undefined` (e.g. an empty `data` set). */
function flattenTreemap(rawtreemap: unknown[][] | undefined): [number, number, number, number][] {
  const flattreemap: [number, number, number, number][] = []

  if (rawtreemap) {
    for (let i = 0; i < rawtreemap.length; i++) {
      for (let j = 0; j < rawtreemap[i].length; j++) {
        flattreemap.push(rawtreemap[i][j] as [number, number, number, number])
      }
    }
  }

  return flattreemap
}

/** Runs the full squarify pipeline for one flat, single-dimensional data set: normalizes it to the
 * `width * height` pixel area, squarifies it into a fresh `width`x`height` container positioned at
 * `(xoffset, yoffset)`, and flattens the result into one box-corners array per input value (same
 * order as `data`). */
function treemapSingledimensional(data: number[], width: number, height: number, xoffset = 0, yoffset = 0): [number, number, number, number][] {
  const rawtreemap = squarify(normalize(data, width * height), [], new TreemapContainer(xoffset, yoffset, width, height), [])
  return flattenTreemap(rawtreemap)
}

/** Literal port of legacy `chart.brush.treemap.calculator`'s exported `treemapMultidimensional`
 * function - the squarify layout entry point `treemap.ts`'s `drawBefore()` calls directly. Accepts
 * either a flat `number[]` (single-dimensional) or a nested `number[][]` (one squarify pass per
 * dimension level) - see `treemap.ts`'s own header comment for how `convertNodeToArray()` always
 * produces exactly a 2-level-deep array in practice. */
export function treemapMultidimensional(data: unknown[], width: number, height: number, xoffset = 0, yoffset = 0): unknown[] {
  const mergeddata: number[] = []
  let results: unknown[] = []

  if (Array.isArray(data[0])) {
    for (let i = 0; i < data.length; i++) {
      mergeddata[i] = sumMultidimensionalArray(data[i] as unknown[])
    }

    const mergedtreemap = treemapSingledimensional(mergeddata, width, height, xoffset, yoffset)

    for (let i = 0; i < data.length; i++) {
      results.push(
        treemapMultidimensional(
          data[i] as unknown[],
          mergedtreemap[i][2] - mergedtreemap[i][0],
          mergedtreemap[i][3] - mergedtreemap[i][1],
          mergedtreemap[i][0],
          mergedtreemap[i][1],
        ),
      )
    }
  } else {
    results = treemapSingledimensional(data as number[], width, height, xoffset, yoffset)
  }
  return results
}
