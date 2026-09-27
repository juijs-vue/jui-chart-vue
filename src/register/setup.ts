// Single module-load side-effect entry point: registers `jui-graph-ts`'s real `Axis` (required
// before `Builder.drawAxis()` will work at all - it throws `"no Axis implementation registered"`
// otherwise), plus every brush/widget/theme this project covers so far. Imported once (for its
// side effects) by `Chart.vue`.
import { registerAxis, Axis } from 'jui-graph-ts'

registerAxis(Axis as unknown as Parameters<typeof registerAxis>[0])

// Phase 1
import './brush/bar'
import './brush/column'
import './brush/line'
import './brush/area'
import './brush/pie'

import './widget/title'
import './widget/tooltip'
import './widget/legend'

import './theme/classic'
import './theme/dark'
import './theme/gradient'
import './theme/pattern'

import './icon/classic'

import './pattern/classic'

// Phase 2, batch 1: bar-derived family
import './brush/rangebar'
import './brush/rangecolumn'
import './brush/stackbar'
import './brush/stackcolumn'
import './brush/fullstackbar'
import './brush/fullstackcolumn'
import './brush/equalizerbar'
import './brush/equalizercolumn'
import './brush/ratebar'
import './brush/bargauge'

// Phase 2, batch 2: line/area-derived + scatter-derived family
import './brush/stackline'
import './brush/stackarea'
import './brush/rangearea'
import './brush/scatter'
import './brush/bubble'
import './brush/stackscatter'

// Phase 2, batch 3: pie/gauge-derived family + candlestick/selectbox
import './brush/donut'
import './brush/fullgauge'
import './brush/equalizer'
import './brush/pin'
import './brush/candlestick'
import './brush/selectbox'

// Phase 2, batch 4a: heatmap-derived + misc simpler brushes
import './brush/heatmap'
import './brush/heatmapscatter'
import './brush/focus'
import './brush/pyramid'
import './brush/arcequalizer'

// Phase 2, batch 4b: the complex/unique ones (LAST brush batch - all 36 legacy brushes now done)
import './brush/treemap'
import './brush/flame'
import './brush/timeline'
import './brush/topologynode'

// Phase 3, widget batch 1: simple/standalone widgets
import './widget/raycast'
import './widget/scroll'
import './widget/vscroll'
import './widget/cross'

// Phase 3, widget batch 2: selection-rectangle family
import './widget/dragselect'
import './widget/guideline'
import './widget/zoomselect'

// Phase 3, widget batch 3 (LAST widget batch): zoom/pan family
import './widget/topologyctrl'
import './widget/zoom'
import './widget/zoomscroll'

// Phase 4: canvas/polygon (3D + canvas-rendered) brush/widget family, plus the site-only
// "pastel" theme
import './brush/canvas/activebubble'
import './brush/canvas/activecircle'
import './brush/canvas/bubblecloud'
import './brush/canvas/dot3d'
import './brush/canvas/equalizercolumn'
import './brush/polygon/column3d'
import './brush/polygon/line3d'
import './brush/polygon/scatter3d'

import './widget/canvas/picker'
import './widget/polygon/rotate3d'

import './theme/pastel'

// Phase 5: further genuine porting gaps found by cross-checking real site demos against this
// project's registered types (neither had ANY counterpart anywhere in this repo's copied legacy
// source tree, despite being real, live code in the bundled site engine and used directly by real
// site demos - see each file's own header comment for the exact provenance/cross-check).
import './brush/splitline'
import './brush/splitarea'

// Phase 6: a full-repo demo scan (161 real site demos) found 39 further completely-unregistered
// brush/widget types - batch 1, the 12 self-contained/small-dependency-chain ones.
import './brush/path'
import './brush/hudbar'
import './brush/hudcolumn'
import './brush/waterfall'
import './brush/scatterpath'
import './brush/circlegauge'
import './brush/arcgauge'
import './brush/ohlc'
import './brush/imagebar'
import './brush/patternbar'
import './brush/imagecolumn'
import './brush/patterncolumn'

// Phase 6, batch 2: canvas.scatter / canvas.scatter3d / canvas.model3d
import './brush/canvas/scatter'
import './brush/canvas/scatter3d'
import './brush/canvas/model3d'

// Phase 6, batch 3: the "grid3d"-axis pseudo-3D (isometric extrusion) bar/column/cylinder/bubble
// family - a SEPARATE 3D system from the polygon.* family's real rotate+perspective engine.
import './brush/bar3d'
import './brush/column3d'
import './brush/cylinder3d'
import './brush/clusterbar3d'
import './brush/clustercolumn3d'
import './brush/clustercylinder3d'
import './brush/stackbar3d'
import './brush/stackcolumn3d'
import './brush/stackcylinder3d'
import './brush/fullstackbar3d'
import './brush/fullstackcolumn3d'
import './brush/fullstackcylinder3d'
import './brush/bubble3d'

// Phase 6, batch 4 (LAST batch): the map.* brush/widget family, on top of jui-graph-ts's already-
// ported base/map.ts "chart.map" engine + brush/map/core.ts + widget/map/core.ts.
import './brush/map/bubble'
import './brush/map/selector'
import './brush/map/marker'
import './brush/map/note'
import './brush/map/weather'
import './brush/map/comparebubble'
import './brush/map/flightroute'

import './widget/map/tooltip'
import './widget/map/control'
import './widget/map/minimap'

// www.jui-vue.io gallery/realtime demo: its second dashboard chart runs in `canvas: true` mode
// and configures `{ type: "canvas.dragselect" }` - a genuinely separate implementation from
// `./widget/dragselect`'s plain SVG version (see that file's own updated header comment for why
// an SVG-drawn rect wouldn't even be visible under a canvas-mode chart).
import './widget/canvas/dragselect'

export { GRID_TYPES } from './gridTypes'
