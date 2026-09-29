// Port of `jui-chart`'s OWN `src/grid/topologytable.js` ("chart.grid.topologytable", extend:
// "chart.grid.core") - a downstream extension `jui-chart` supplies itself, exactly like its own
// themes/icons (see `base/builder.ts`'s header comment on that category) - NOT part of
// `juijs-graph`/`jui-graph-ts` at all, so no `jui-graph-ts` change was needed here (corrected from
// this file's own earlier, mistaken "missing engine grid" framing). Registered here, in this
// project's own `src/register/grid/` (the first grid this project adds - `src/register/gridTypes.ts`
// wires it into `GRID_TYPES` alongside every `jui-graph-ts`-shipped grid).
//
// Real purpose: the `axis.c` ("custom" slot) grid `topologynode.js` requires - a table of
// pre-scattered `{x, y}` node positions (chosen once, by one of two swappable "sort" strategies,
// below) plus a small mutable pan/zoom cache (`scale`/`viewX`/`viewY`) the (separately out-of-scope
// `topologyctrl`) widget reads/writes via the closures `scale(index)` returns.
//
// **No `custom()` method - a literal, confirmed-safe omission, not a mistake**: `base/axis.ts`'s
// `drawGridType()` unconditionally forces `gridCfg.orient = "custom"` for the "c" slot (matching
// every grid type used there, not just the auto-registered default "panel" grid) - so
// `CoreGrid.drawGrid()`'s own `this[this.grid.orient]` lookup resolves to `this.custom`. The real
// `topologytable.js` (confirmed by reading it in full) defines ONLY `drawBefore`/`draw` - no
// `custom`/`top`/`bottom`/etc. method at all. This is safe because `drawGrid()`'s own dispatch is
// itself already guarded (`if (typeCheck("function", func)) { ... }` - see `grid/core.ts`'s
// `drawGrid()`): with no `custom` method, that whole branch (the 2D/3D draw mixin application and
// the orient-method call) is silently skipped, leaving `root` an empty (and `hide:true`, so
// invisible anyway) group - genuinely correct, since this grid's real value is never visual, it's
// the `this.scale` closure `drawBefore()` builds (still returned by `drawGrid()` regardless of the
// skipped branch, since `this.scale = this.wrapper(...)` runs unconditionally BEFORE that guard).
import { CoreGrid, type BrushData } from 'jui-graph-ts'

interface TopologyTableCacheEntry {
  x: number
  y: number
}

/** Literal port of legacy `chart.topology.sort.random` (a `jui.define([], function() {...})`
 * with no dependencies) - scatters every node at a uniformly random position within the axis area
 * (minus a `space` margin on each edge). */
function randomSort(data: unknown[], area: { x: number; y: number; width: number; height: number }, space: number): TopologyTableCacheEntry[] {
  const xy: TopologyTableCacheEntry[] = []

  for (let i = 0; i < data.length; i++) {
    const x = Math.floor(Math.random() * (area.width - space))
    const y = Math.floor(Math.random() * (area.height - space))

    xy[i] = {
      x: area.x + x,
      y: area.y + y,
    }
  }

  return xy
}

/** Literal port of legacy `chart.topology.sort.linear` - alternates filling columns from the
 * left (even `i`) and from the right (`odd `i`), each at a random row, to spread nodes across the
 * grid without the pure-random overlap `randomSort` allows. `cache`/`getRandomRowIndex` are a
 * per-module CLOSURE in the original (declared once outside the returned function, like
 * `flame.js`'s own `newData` - see that file's header comment on this project's precedent for
 * porting such state as a literal, not-reset-on-every-call module-level value) - ported here as a
 * MODULE-LEVEL (not per-call-local) `cache` object for the same reason: a real chart calling this
 * sort function more than once (e.g. on remount) would see the SAME accumulating `cache` state the
 * real original engine's single shared module instance would, not a fresh one each time. */
const linearSortCache: Record<number, boolean> = {}

function getRandomRowIndex(row_cnt: number): number {
  const row_index = Math.floor(Math.random() * row_cnt)

  if (linearSortCache[row_index]) {
    let cnt = 0
    for (const _k in linearSortCache) {
      cnt++
    }

    if (cnt < row_cnt) {
      return getRandomRowIndex(row_cnt)
    } else {
      for (const k in linearSortCache) delete linearSortCache[k]
    }
  } else {
    linearSortCache[row_index] = true
  }

  return row_index
}

function linearSort(data: unknown[], area: { x: number; y: number; width: number; height: number }, space: number): TopologyTableCacheEntry[] {
  const xy: TopologyTableCacheEntry[] = []
  const row_cnt = Math.floor(area.height / space)
  const col_cnt = Math.floor(area.width / space)
  const col_step = Math.floor(col_cnt / data.length)
  let col_index = 0

  let left = -1
  let right = data.length

  for (let i = 0; i < data.length; i++) {
    let x = 0
    let y = 0
    let index = 0

    if (i % 2 === 0) {
      x = col_index * space
      y = getRandomRowIndex(row_cnt) * space
      col_index += col_step

      left += 1
      index = left
    } else {
      x = (col_cnt - col_index) * space + space
      y = getRandomRowIndex(row_cnt) * space

      right -= 1
      index = right
    }

    xy[index] = {
      x: area.x + x + space,
      y: area.y + y + space / 2,
    }
  }

  return xy
}

/** Replaces the legacy `jui.include("chart.topology.sort." + this.grid.sort)` string-registry
 * lookup - same "real object/map, not a runtime registry" rule this whole project has applied to
 * every other `jui.include()` call site. */
const SORT_STRATEGIES: Record<string, (data: unknown[], area: { x: number; y: number; width: number; height: number }, space: number) => TopologyTableCacheEntry[]> = {
  random: randomSort,
  linear: linearSort,
}

/** `chart.grid.topologytable`'s own config fields (on top of `jui-graph-ts`'s base grid
 * options). */
export interface TopologyTableGridOptions {
  /** Which `SORT_STRATEGIES` entry scatters each node's initial `{x, y}` position: `'linear'`
   * spreads nodes across alternating columns (left/right) at a random row each; `'random'`
   * places every node at a uniformly random position. An unrecognized value (outside the
   * `'linear' | 'random'` union - e.g. from an untyped/JSON/API config source) falls back to
   * `'linear'`, the same strategy used when `sort` isn't configured at all (see `drawBefore()`'s
   * own comment on why this fallback exists). */
  sort?: 'linear' | 'random'
  /** Margin in px reserved from the axis area's own edges when scattering node positions
   * (`'random'`), or the row/column pitch nodes are placed on (`'linear'`). */
  space?: number
}

/** Own `chart.grid.topologytable.setup()` fields - see legacy `topologytable.js`. */
export const TOPOLOGYTABLE_GRID_OWN_DEFAULTS: TopologyTableGridOptions = {
  sort: 'linear',
  space: 50,
}

/** The `{x, y, scale}` + mutator-closure shape `axis.c(index)` resolves to - see
 * `topologynode.ts`'s own `TopologyScale` type, which this satisfies. */
interface TopologyTableScaleResult {
  setX(value: number): void
  setY(value: number): void
  setScale(s: number): void
  setView(x: number, y: number): void
  moveLast(): void
  x?: number
  y?: number
  scale?: number
}

/** `chart.grid.topologytable` - a `jui-chart`-own grid extension (not part of `jui-graph-ts`
 * itself, see this file's own header comment) providing the pre-scattered `{x, y}` node-position
 * table plus pan/zoom mutator closures (`setX`/`setY`/`setScale`/`setView`/`moveLast`) that
 * `topologynode.ts`'s brush and the `topologyctrl` widget both read/write via `axis.c(index)`. */
export class TopologyTableGrid extends CoreGrid {
  private getDataIndex(key: unknown): number | null {
    const data = this.axis.data as BrushData[]

    for (let i = 0, len = data.length; i < len; i++) {
      if (this.axis.getValue(data[i], 'key') === key) {
        return i
      }
    }

    return null
  }

  drawBefore = (): void => {
    const axis = this.axis as unknown as { cacheXY?: TopologyTableCacheEntry[]; cache?: { scale: number; viewX: number; viewY: number; nodeKey: string | null }; data: unknown[]; area: () => { x: number; y: number; width: number; height: number } }
    const grid = this.grid as unknown as { sort: string; space: number }

    if (!axis.cacheXY) {
      // **Fixed - was a real, live crash, not "dead/unreachable in ordinary usage" as a previous
      // version of this comment claimed**: `scale()`'s returned closure below unconditionally
      // dereferences `axisRef.cacheXY![resolvedIndex]` in `setX`/`setY`/the position getter, and
      // that closure is used on the VERY FIRST render of any `topologynode` chart - not just on
      // some later interaction. Any `grid.sort` value that isn't exactly `'linear'` or `'random'`
      // (a typo, or any config from an untyped/JSON/API source bypassing the
      // `'linear' | 'random'` TS union) left `sortFunc` `undefined` with no `else` branch, so
      // `axis.cacheXY` was never assigned and the whole chart crashed on first render. The
      // original engine's own fallback (`jui.include("chart.topology.sort." + this.grid.sort)`,
      // treating `grid.sort` itself as a raw registry key) has no equivalent here (no real
      // registry exists in this port, per this whole project's Phase 0 rule 1), so instead of
      // reproducing that second lookup, an unrecognized `sort` now falls back to the `'linear'`
      // strategy - the same strategy `TOPOLOGYTABLE_GRID_OWN_DEFAULTS.sort` already uses when
      // `sort` isn't configured at all, so this is consistent with the documented default rather
      // than an invented new behavior.
      const sortFunc = SORT_STRATEGIES[grid.sort] ?? SORT_STRATEGIES.linear

      axis.cacheXY = sortFunc(axis.data, axis.area(), grid.space)
    }

    if (!axis.cache) {
      axis.cache = {
        scale: 1,
        viewX: 0,
        viewY: 0,
        nodeKey: null,
      }
    }

    const self = this

    this.scale = ((axisRef: typeof axis) => {
      return function (index?: number | string): TopologyTableScaleResult {
        const resolvedIndex = typeof index === 'string' ? self.getDataIndex(index) : index

        const func: TopologyTableScaleResult = {
          setX(value: number) {
            axisRef.cacheXY![resolvedIndex as number].x = value - axisRef.cache!.viewX
          },
          setY(value: number) {
            axisRef.cacheXY![resolvedIndex as number].y = value - axisRef.cache!.viewY
          },
          setScale(s: number) {
            axisRef.cache!.scale = s
          },
          setView(x: number, y: number) {
            axisRef.cache!.viewX = x
            axisRef.cache!.viewY = y
          },
          moveLast() {
            const target1 = (axisRef.cacheXY as TopologyTableCacheEntry[]).splice(resolvedIndex as number, 1)
            ;(axisRef.cacheXY as TopologyTableCacheEntry[]).push(target1[0])

            const target2 = (axisRef.data as unknown[]).splice(resolvedIndex as number, 1)
            ;(axisRef.data as unknown[]).push(target2[0])
          },
        }

        if (typeof resolvedIndex === 'number' && Number.isInteger(resolvedIndex)) {
          const x = axisRef.cacheXY![resolvedIndex].x + axisRef.cache!.viewX
          const y = axisRef.cacheXY![resolvedIndex].y + axisRef.cache!.viewY
          const scale = axisRef.cache!.scale

          return Object.assign(func, { x: x * scale, y: y * scale, scale })
        }

        return func
      }
    })(axis)
  }

  draw = (): { root: any; scale: any } => {
    ;(this.grid as unknown as { hide: boolean }).hide = true
    return this.drawGrid()
  }

  static setup(): Record<string, unknown> {
    return TOPOLOGYTABLE_GRID_OWN_DEFAULTS as Record<string, unknown>
  }
}
