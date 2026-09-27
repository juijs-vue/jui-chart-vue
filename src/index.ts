// Library entry point. Importing this module registers every brush/widget/theme this project
// covers as a side effect (via `./register/setup`).
import './register/setup'

export { default as Chart } from './Chart.vue'
export type { AxisConfig, AxisPadding, BrushConfig, WidgetConfig } from './Chart.vue'

// Re-exported for consumers (e.g. www.jui-vue.io's play/chart legacy `chart.builder` shim) that
// need the raw jui-graph-ts `Builder` directly instead of going through `<Chart>` - same engine,
// same registered types, just the imperative `chart.builder(selector, options)`-shaped API that
// legacy demo code (`chart.axis(0).update(...)`, `chart.render()`, `chart.updateBrush(...)`, etc.)
// expects. `GRID_TYPES` must be assigned onto every `Builder` instance before `.mount()` (see
// `Chart.vue`'s own `remount()`), exactly mirroring how the real engine wires registered axis types.
//
// Exports `./register/chartMap.ts`'s `ChartBuilder` (a thin `Builder` subclass) here, NOT
// `jui-graph-ts`'s own `Builder` directly - `ChartBuilder`'s only difference is its own `mount()`
// override pre-processing any `axis[].map` config (the `map.*` brush/widget family's own axis
// shape) through `preprocessMapAxis()`, working around two real, compounding bugs in already-
// ported `jui-graph-ts` code (`base/map.ts`/`base/axis.ts`) this project may not modify directly -
// see `chartMap.ts`'s own header comment for the full writeup. Since www.jui-vue.io's own
// `chart.builder` shim (`play/chart/chart.js`) uses THIS exact re-export directly and never goes
// through `<Chart>`/Vue at all, fixing the bug only inside `Chart.vue` would never reach it - this
// re-export is the one place both real entry points into this project's engine share.
export { ChartBuilder as Builder } from './register/chartMap'
export { GRID_TYPES } from './register/setup'

// Re-exported so a consumer can register a genuinely NEW, demo-specific brush/widget (one not
// worth adding to this project's own shared registry - e.g. www.jui-vue.io's gallery/gps demo's
// own "radar"/"compass" widgets) against the SAME registry <Chart> actually reads from at draw
// time. `jui-graph-ts` is bundled directly into this package's own dist-lib output (not marked
// `external` in vite.lib.config.ts) - a consumer that separately depended on `jui-graph-ts` on its
// own would get a SECOND, independent copy with its own separate registry Map, and anything
// registered there would be invisible to <Chart>. Importing these FROM HERE instead guarantees
// the same module instance, and thus the same registry.
export { CoreWidget, registerWidget, registerBrush, registerTheme, mathUtil, colorUtil, timeUtil } from 'jui-graph-ts'
