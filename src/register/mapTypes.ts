// Real, ES-module-imported constructor for jui-graph-ts's single `chart.map` engine class - the
// `AxisChart.mapType` stand-in for the legacy engine's dropped, single, unconditional
// `jui.include("chart.map")`.
//
// Unlike `gridTypes.ts`'s `GRID_TYPES` (a STRING-keyed record of concrete grid classes, one per
// `axis.x.type`/`.y.type`/`.z.type`/`.c.type` config string), `base/axis.ts`'s own
// `AxisChart.mapType` contract is a SINGLE constructor slot (`mapType?: MapConstructor`), not a
// keyed map - there's only ever one map engine, matching the original's own single, unconditional
// `jui.include("chart.map")` (see that file's own header comment). So this file exports one
// constructor, `MAP_TYPE`, not a `MAP_TYPES` record.
//
// **Why this file didn't (functionally) need to exist until now, and what it changes**: this
// project already had a WORKING map-rendering path before this file was added - built entirely
// around two independent, already-ported `jui-graph-ts` defects that `./chartMap.ts`'s own
// `ChartBuilder`/`preprocessMapAxis()`/`createMapConfig()` work around (see that file's own, much
// longer header comment for the full two-bug writeup). One of those two bugs was `base/map.ts`'s
// own `Map` class never defining a `render()` method at all (`jui-graph-ts`'s Tier-A defect,
// documented at length in that file's header comment) - `chartMap.ts`'s constructor already
// stamped a truthy `mapType` placeholder (`Object.assign(this, { mapType: EngineMap })`, where
// `EngineMap` is this exact same `Map` class) purely to clear `drawMapType()`'s early
// `if (!MapCtor) return null` guard, since `Map` couldn't satisfy `MapConstructor` at all without
// a real `render()`.
//
// `jui-graph-ts` has since fixed that defect (`Map` now defines a real `render()`, bridging its own
// `draw()`/`drawAfter()` exactly like `Draw.render()` does for a real subclass), so `Map` now
// genuinely, structurally satisfies `MapConstructor`/`MapInstance` for the first time. This file
// makes that wiring explicit, named, and consistent with `gridTypes.ts`'s own pattern - `Chart.vue`
// stamps `MAP_TYPE` onto each `Builder` instance the same way it already stamps `GRID_TYPES`,
// instead of relying on `chartMap.ts`'s constructor side effect alone. This is a genuine
// improvement in its own right (the wiring is now real and intentional, not just a "truthy
// placeholder" the type system happened to accept before `render()` existed) - it does NOT, on its
// own, change which class actually does the real per-path drawing work, since `chartMap.ts`'s
// `createMapConfig()` still bypasses `AxisChart.mapType`'s own `new MapCtor(...)` construction
// path entirely (a SEPARATE, already-ported `base/axis.ts` defect - out of scope for this project
// to fix, since it lives in an already-ported file this project doesn't touch - see `chartMap.ts`'s
// header comment for the full "why `new MapCtor(...)` never actually runs" explanation) and
// instead constructs/drives its own internal `Map` instance directly via `draw()`/`drawAfter()`.
import { Map as EngineMap, type MapConstructor } from 'jui-graph-ts'

/** The single `AxisChart.mapType` constructor this project registers - stamped onto each
 * `Builder` instance (`Object.assign(builder, { mapType: MAP_TYPE })`) by `Chart.vue`, mirroring
 * `GRID_TYPES`' own wiring pattern (see this file's header comment for why this is a single
 * constructor, not a keyed record like `GRID_TYPES`). */
export const MAP_TYPE: MapConstructor = EngineMap as unknown as MapConstructor
