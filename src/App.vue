<script setup lang="ts">
import BrushColors from './demos/BrushColors.vue'
import PieSample from './demos/PieSample.vue'
import AreaSample from './demos/AreaSample.vue'
import RangeBarSample from './demos/RangeBarSample.vue'
import StackBarSample from './demos/StackBarSample.vue'
import FullStackSample from './demos/FullStackSample.vue'
import EqualizerSample from './demos/EqualizerSample.vue'
import RateBarSample from './demos/RateBarSample.vue'
import BarGaugeSample from './demos/BarGaugeSample.vue'
import StackLineSample from './demos/StackLineSample.vue'
import StackAreaScatterSample from './demos/StackAreaScatterSample.vue'
import RangeAreaSample from './demos/RangeAreaSample.vue'
import ScatterSample from './demos/ScatterSample.vue'
import BubbleSample from './demos/BubbleSample.vue'
import DonutSample from './demos/DonutSample.vue'
import FullGaugeSample from './demos/FullGaugeSample.vue'
import EqualizerMeterSample from './demos/EqualizerMeterSample.vue'
import CandlestickSample from './demos/CandlestickSample.vue'
import PinSample from './demos/PinSample.vue'
import SelectBoxSample from './demos/SelectBoxSample.vue'
import HeatmapSample from './demos/HeatmapSample.vue'
import PyramidSample from './demos/PyramidSample.vue'
import ArcEqualizerSample from './demos/ArcEqualizerSample.vue'
import FocusSample from './demos/FocusSample.vue'
import HeatmapScatterSample from './demos/HeatmapScatterSample.vue'
import TreemapSample from './demos/TreemapSample.vue'
import FlameSample from './demos/FlameSample.vue'
import TimelineSample from './demos/TimelineSample.vue'
import TopologyNodeSample from './demos/TopologyNodeSample.vue'
import CrossSample from './demos/CrossSample.vue'
import ScrollSample from './demos/ScrollSample.vue'
import DragSelectSample from './demos/DragSelectSample.vue'
import GuidelineSample from './demos/GuidelineSample.vue'
import ZoomSelectSample from './demos/ZoomSelectSample.vue'
import ZoomSample from './demos/ZoomSample.vue'
import ZoomScrollSample from './demos/ZoomScrollSample.vue'
import DarkThemeSample from './demos/DarkThemeSample.vue'
import GradientThemeSample from './demos/GradientThemeSample.vue'
import PatternThemeSample from './demos/PatternThemeSample.vue'
import IconSample from './demos/IconSample.vue'
import UpdateAxisGridSample from './demos/UpdateAxisGridSample.vue'
</script>

<template>
  <main>
    <h1>jui-chart-vue demos</h1>
    <h2 class="phase-heading">Phase 1</h2>
    <BrushColors />
    <PieSample />
    <AreaSample />
    <h2 class="phase-heading">Phase 2, batch 1: bar-derived family</h2>
    <RangeBarSample />
    <StackBarSample />
    <FullStackSample />
    <EqualizerSample />
    <RateBarSample />
    <BarGaugeSample />
    <h2 class="phase-heading">Phase 2, batch 2: line/area + scatter-derived family</h2>
    <StackLineSample />
    <StackAreaScatterSample />
    <RangeAreaSample />
    <ScatterSample />
    <BubbleSample />
    <h2 class="phase-heading">Phase 2, batch 3: pie/gauge-derived family + candlestick/selectbox</h2>
    <DonutSample />
    <FullGaugeSample />
    <EqualizerMeterSample />
    <CandlestickSample />
    <PinSample />
    <SelectBoxSample />
    <h2 class="phase-heading">Phase 2, batch 4a: heatmap-derived + misc simpler brushes</h2>
    <HeatmapSample />
    <PyramidSample />
    <ArcEqualizerSample />
    <FocusSample />
    <HeatmapScatterSample />
    <h2 class="phase-heading">Phase 2, batch 4b: the complex/unique ones (last brush batch)</h2>
    <TreemapSample />
    <FlameSample />
    <TimelineSample />
    <TopologyNodeSample />
    <h2 class="phase-heading">Phase 3, widget batch 1: simple/standalone widgets</h2>
    <CrossSample />
    <ScrollSample />
    <h2 class="phase-heading">Phase 3, widget batch 2: selection-rectangle family</h2>
    <DragSelectSample />
    <GuidelineSample />
    <ZoomSelectSample />
    <h2 class="phase-heading">Phase 3, widget batch 3 (last widget batch): zoom/pan family</h2>
    <ZoomSample />
    <ZoomScrollSample />
    <h2 class="phase-heading">Phase 4: remaining themes (last batch of this round)</h2>
    <DarkThemeSample />
    <GradientThemeSample />
    <PatternThemeSample />
    <h2 class="phase-heading">Icon font subsystem</h2>
    <IconSample />
    <h2 class="phase-heading">Bug fix verification: update_axis_grid</h2>
    <UpdateAxisGridSample />
  </main>
</template>

<style>
body {
  font-family: arial, sans-serif;
  margin: 0;
  padding: 24px;
  background: #f5f5f5;
}
.demo {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
  display: inline-block;
}
.demo h2 {
  margin-top: 0;
  font-size: 14px;
  color: #555;
}
</style>
