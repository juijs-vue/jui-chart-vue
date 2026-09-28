// Real, ES-module-imported map of every grid type `jui-graph-ts` already ships (Phase C of that
// project), keyed the same way the legacy `jui-chart`/`juijs-graph` engine's own `axis.x.type`/
// `axis.y.type`/`axis.z.type`/`axis.c.type` config strings did (`"block"`, `"range"`, etc).
//
// `jui-graph-ts`'s `Axis` (base/axis.ts) resolves a grid's concrete constructor via
// `this.chart.gridTypes[type]` (its `AxisChart.gridTypes` contract) - but `Builder`
// (base/builder.ts) itself never populates that field (confirmed by reading the full source: no
// `gridTypes`/`mapType` property exists on `Builder` at all). Per that file's own header comment,
// this wiring is meant to be done by "whatever assembles the real chart" - i.e. this project's
// `<Chart>` component. `Chart.vue` stamps this map directly onto each `Builder` instance
// (`Object.assign(builder, { gridTypes: GRID_TYPES })`) before calling `.mount()`, since `mount()`
// synchronously renders (see `Builder.init()`'s last line) and `Axis`'s constructor reads
// `chart.gridTypes` during that very first render.
//
// See the final report's "gridTypes wiring" note - this is a mandatory technical requirement (not
// an optional judgment call) uncovered while reading `base/axis.ts`/`base/builder.ts` in full, not
// something anticipated by PLAN.md's own corrected-facts list.
import {
  BlockGrid,
  RangeGrid,
  FullBlockGrid,
  PanelGrid,
  DateGrid,
  DateBlockGrid,
  LogGrid,
  RadarGrid,
  Grid3D,
  OverlapGrid,
  TableGrid,
  type GridConstructor,
} from 'jui-graph-ts'
// `topologytable` is a `jui-chart`-OWN grid extension (not part of `juijs-graph`/`jui-graph-ts`
// itself - see `topologytable.ts`'s own header comment), so it lives in THIS project's own
// `src/register/grid/`, not imported from `jui-graph-ts` like every grid above.
import { TopologyTableGrid } from './grid/topologytable'

/** Every grid type this project registers, keyed by the same `axis.x.type`/`.y.type`/`.z.type`/
 * `.c.type` config strings the legacy engine used - stamped onto each `Builder` instance
 * (`chart.gridTypes = GRID_TYPES`) by `Chart.vue` before mounting, since `Builder` itself never
 * populates that field on its own (see this file's own header comment for the full "who's
 * responsible for wiring this" investigation). */
export const GRID_TYPES: Record<string, GridConstructor> = {
  block: BlockGrid as unknown as GridConstructor,
  range: RangeGrid as unknown as GridConstructor,
  fullblock: FullBlockGrid as unknown as GridConstructor,
  panel: PanelGrid as unknown as GridConstructor,
  date: DateGrid as unknown as GridConstructor,
  dateblock: DateBlockGrid as unknown as GridConstructor,
  log: LogGrid as unknown as GridConstructor,
  radar: RadarGrid as unknown as GridConstructor,
  grid3d: Grid3D as unknown as GridConstructor,
  overlap: OverlapGrid as unknown as GridConstructor,
  table: TableGrid as unknown as GridConstructor,
  topologytable: TopologyTableGrid as unknown as GridConstructor,
}
