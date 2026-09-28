// Makes `axis: [{ map: {...} }]` (the `map.*` brush/widget family's own axis config) actually
// work, working around a REAL, confirmed bug that lives ACROSS TWO already-ported jui-graph-ts
// files this project must not modify (`base/map.ts`/`base/axis.ts`) - not one bug, but two that
// compound:
//
// 1. **`base/map.ts`'s own documented "HEADLINE FINDING"**: the raw open-source `juijs-graph` npm
//    package's `chart.map` never declares `extend: "chart.draw"`, so it never gets a `render()`
//    method, even though `axis.ts`'s `drawMapType()` unconditionally calls `mapInstance.render()`
//    - "calling axis.js's map-axis code path in the real, shipped juijs-graph/jui-chart ALWAYS
//    throws `TypeError: map.render is not a function`... chart.map's entire declared purpose is
//    unreachable dead code in production." Confirmed genuinely fixed on the REAL SITE's own
//    bundled engine though (`www.jui-vue.io/lib/jui/js/chart.js`'s own `chart.map` definition
//    literally ends `}, "chart.draw");`) - this project's `map.*` family targets that real,
//    working site behavior (same "site diverges from the raw npm package" situation
//    `register/theme/pastel.ts` already documents for the unrelated "pastel" theme).
//
// 2. **A second, compounding bug this project found while wiring up a fix for #1**: `axis.ts`'s
//    own `Axis.reload()` does `extend(this, { ..., map: options.map })` (copying the user's raw
//    `{path, width, height, ...}` config onto the axis's OWN private `map` field) BEFORE
//    `drawMapType()` ever runs - so by the time `drawMapType()` reaches its own `this.map ??= new
//    MapCtor(...)` lazy-construction guard, `this.map` is ALREADY truthy (the raw config object,
//    not `null`) and the guard silently NO-OPS, skipping real `Map` construction entirely -
//    `this.map` stays the plain config object forever, `.render()` is called on IT, not a real
//    `Map` instance, regardless of whether `AxisChart.mapType` even resolves to a working
//    constructor. Verified empirically (a working `mapType` constructor's own `render()` is never
//    invoked at all - 0 calls, confirmed via instrumentation - precisely because `new
//    MapCtor(...)` is never reached). This is a second real defect in already-ported code this
//    project must not touch either.
//
// **The fix, entirely within this project's own authority**: since `AxisChart.mapType` never
// actually gets consulted (bug #2 means construction never happens), fixing this can't go through
// that mechanism at all. Instead, `createMapConfig()` below pre-processes the USER's raw `axis[].
// map` config object itself (in `Chart.vue`, before it ever reaches `Builder.mount()`) into a
// plain object that already carries its own `render`/`draw`/`drawAfter` methods - so by the time
// `extend(this, { map: options.map })` copies THIS object onto the axis's `this.map` field, it's
// already a fully-working "map instance" as far as `drawMapType()`'s duck-typed `this.map.
// render()` call cares, no `new MapCtor(...)` construction ever needed. Those 3 methods construct
// a REAL `jui-graph-ts` `Map` instance internally (memoized, built once) and delegate to its own
// `draw()`/`drawAfter()` - `chart`/`axis`/`svg` are copied onto that real instance at call time
// (populated onto the OUTER object externally by `drawMapType()`'s own 4 assignment lines,
// unmodified), and its own `.map` field is pointed at the OUTER object itself (self-referential,
// exactly matching what `drawMapType()`'s own `this.map.map = n` assignment already does in the
// broken path) - so `Map`'s own internal code, which reads `this.map.path`/`.width`/`.height`/
// `.scale` (a NUMBER, the user's own zoom-level config key) off its `this.map` field, finds the
// real user values directly on that same outer object. Real `Map.scale` (a CALLABLE `MapScale`
// FUNCTION, a genuinely different field that would otherwise collide with the user's own numeric
// `scale` config key under the same name) stays safely on the INNER real instance, never flattened
// onto the outer object - the two `scale`s never collide because they live on two different
// objects.
import { Builder, Map as EngineMap } from 'jui-graph-ts'
import type { MapScale } from 'jui-graph-ts'

/** `jui-graph-ts`'s own `Builder`, with `preprocessMapAxis()` applied to every `mount()` call -
 * see this file's own header comment. This is what `index.ts` re-exports as `Builder` (replacing
 * a raw pass-through) and what `Chart.vue` constructs, so both real entry points into this
 * project's engine get the map-axis fix, not just one. */
export class ChartBuilder extends Builder {
  constructor() {
    super()
    // `base/axis.ts`'s `drawMapType()` bails out `return null` immediately whenever
    // `this.chart.mapType` is falsy - BEFORE it ever reaches its own `this.map ??= new
    // MapCtor(...)` guard (the one bug #2 above defeats anyway, since `this.map` is already
    // truthy by then). Without SOME truthy `mapType`, `axis.map` ends up `null` outright (never
    // even reaching the broken-but-harmless-here `??=` path) - `typeof null === "object"` in JS,
    // which is why this was hard to spot from a bare `typeof axis.map` check alone. `EngineMap`
    // itself is used here purely as a truthy placeholder to clear that early-return guard - `new
    // MapCtor(...)` is never actually invoked (the `??=` guard always no-ops, per bug #2), so
    // which real class this is doesn't matter, only that it's truthy.
    Object.assign(this, { mapType: EngineMap })
  }

  mount(...args: Parameters<Builder['mount']>): this {
    const [root, options] = args
    return super.mount(root, preprocessMapAxis((options ?? {}) as Record<string, unknown>) as never)
  }
}

interface MapRenderResult {
  root: unknown
  scale: MapScale
}

/** Walks a `Builder.mount()` options object's `axis` field (a single `AxisConfig` or an array of
 * them) and runs any `.map` block through `createMapConfig()` above, in place. Exported so BOTH
 * real consumption paths get the fix: `Chart.vue`'s own `remount()` AND `index.ts`'s re-exported
 * `Builder` (used directly by www.jui-vue.io's own legacy `chart.builder` shim,
 * `play/chart/chart.js`'s `createChartBuilder()` - which never goes through `<Chart>`/Vue at all,
 * so a fix living only inside `Chart.vue` would never reach it). */
export function preprocessMapAxis<T extends { axis?: unknown }>(options: T): T {
  if (options == null || options.axis == null) return options

  const fix = (axis: unknown): unknown => {
    if (axis == null || typeof axis !== 'object') return axis
    const a = axis as Record<string, unknown>
    if (a.map == null || typeof a.map !== 'object') return axis
    return { ...a, map: createMapConfig(a.map as Record<string, unknown>) }
  }

  const axis = options.axis
  return {
    ...options,
    axis: Array.isArray(axis) ? axis.map(fix) : fix(axis),
  }
}

/** Wraps a raw `axis[].map` user config into a plain object that already carries its own working
 * `render`/`draw`/`drawAfter` methods, so `Axis.reload()`'s own broken lazy-construction path (see
 * this file's own header comment) never needs to run - `drawMapType()`'s duck-typed
 * `this.map.render()` call just works. Internally builds a real `jui-graph-ts` `Map` instance once
 * (memoized in a closure) and delegates to its `draw()`/`drawAfter()`, with `chart`/`axis`/`svg`
 * copied on at call time and the inner instance's own `.map` field pointed back at this same outer
 * object (self-referential, matching the engine's own broken-path assignment shape) so the real
 * `Map` internals find the user's `path`/`width`/`height`/`scale` values directly on it. */
export function createMapConfig(userConfig: Record<string, unknown>): Record<string, unknown> {
  let inner: EngineMap | null = null

  const outer: Record<string, unknown> & {
    draw?: (this: Record<string, unknown>) => MapRenderResult
    drawAfter?: (this: Record<string, unknown>, obj: MapRenderResult) => void
    render?: (this: Record<string, unknown>) => MapRenderResult
  } = { ...userConfig }

  outer.draw = function (this: Record<string, unknown>): MapRenderResult {
    inner ??= new EngineMap()
    ;(inner as unknown as Record<string, unknown>).chart = this.chart
    ;(inner as unknown as Record<string, unknown>).axis = this.axis
    ;(inner as unknown as Record<string, unknown>).svg = this.svg
    // Self-referential, exactly matching `drawMapType()`'s own real (broken-path) `this.map.map =
    // n` assignment - `inner`'s own `.map` field points back at THIS outer config object, which
    // carries the real `path`/`width`/`height`/`scale`(number) values directly.
    ;(inner as unknown as Record<string, unknown>).map = this

    return inner.draw()
  }

  outer.drawAfter = function (_obj: MapRenderResult): void {
    if (inner && typeof inner.drawAfter === 'function') {
      inner.drawAfter(_obj as unknown as Parameters<typeof inner.drawAfter>[0])
    }
  }

  outer.render = function (this: Record<string, unknown>): MapRenderResult {
    const obj = outer.draw!.call(this)
    outer.drawAfter!.call(this, obj)
    return obj
  }

  return outer
}
