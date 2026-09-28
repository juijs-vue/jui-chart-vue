<script setup lang="ts">
// Ported from the real legacy demo `play/chart/json/update_axis_grid.js` (data/config/timing
// copied verbatim, including the real 5-second delay) - mounts with `render: false`, then after 5
// seconds swaps BOTH axes' grid type via two `axis(0).updateGrid(type, {...}, true)` calls (x
// becomes "range", y becomes "block" - the two axes' types are SWAPPED relative to the initial
// mount) followed by one explicit `builder.render()`.
//
// **Investigated as a reported bug** ("mounted once triggers `Builder.render()` FIVE times,
// producing 8 transient `<ellipse cx="null">` SVG errors") - NOT REPRODUCIBLE against this
// project's current codebase. Built this exact demo (matching the legacy config/timing verbatim)
// and instrumented `Builder.prototype.render()` directly, verified with REAL timers in a REAL
// browser (Playwright/Chromium, not jsdom - jsdom doesn't validate SVG attributes the way a real
// renderer does, so it can't reproduce the reported `<ellipse>` warnings even if the underlying
// call-count bug were present) - both in isolation (a single `<Chart>` on an otherwise-empty page)
// and on this project's full ~44-demo page (to rule out any other demo interfering): both
// consistently show exactly 2 `render()` calls (the one mandatory call `Builder.init()` always
// makes at mount, per `base/builder.ts`, plus the one explicit trailing `builder.render()` call
// above) and ZERO console/page errors - matching the theoretical expectation exactly (`Axis.set()`/
// `updateGrid()`'s own `if (this.chart.isRender()) this.chart.render()` guard correctly suppresses
// both `updateGrid()` calls in between, since `isRender()` consults `_options.render` - `false`
// here - once `_initialize` is `true` after that first mandatory render). See `UpdateAxisGridSample.
// spec.ts` for the permanent regression test asserting this exact count.
//
// Best available explanation for the discrepancy (not confirmed, flagged rather than assumed):
// this project's `Chart.vue` already carries two independently-landed fixes squarely in this
// mechanism's path - `cloneForEngine()` (never hands the engine a live reference to a Vue-reactive
// prop value, preventing the engine's own mutate-in-place option merge from corrupting a tracked
// prop and re-triggering `remount()`) and the explicit `render: true` `withDefaults` (closing a
// prop-resolution gap that used to silently flip every un-set `render` prop to `false`) - either
// of which, if this exact bug was originally observed BEFORE they landed, would fully explain a
// symptom shaped like "several extra `remount()`-driven `render()` calls, some hitting a
// mid-swap/inconsistent axis state (explaining transient null-attribute SVG errors)". Flagging this
// as the likely (not certain) explanation rather than claiming a fix for a bug that could not be
// reproduced to fix.
import { onMounted, ref } from 'vue'
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['1Q', '2Q', '3Q', '4Q'], line: true },
    y: { type: 'range', domain: [0, 10000], step: 4 },
    data: [
      { sales: 2100, profit: 1800 },
      { sales: 6000, profit: 4400 },
      { sales: 8300, profit: 6700 },
      { sales: 5200, profit: 4800 },
    ],
  },
]

const brush = [{ type: 'scatter', target: ['sales', 'profit'] }]

const chartRef = ref<InstanceType<typeof Chart> | null>(null)

onMounted(() => {
  setTimeout(() => {
    const builder = chartRef.value?.getBuilder()
    if (!builder) return

    const axis0 = builder.axis(0)

    axis0.updateGrid('y', { type: 'block', domain: ['1Q', '2Q', '3Q', '4Q'], line: true }, true)
    axis0.updateGrid('x', { type: 'range', domain: [0, 10000], step: 4 }, true)

    builder.render()
  }, 5000)
})
</script>

<template>
  <div class="demo">
    <h2>update_axis_grid</h2>
    <Chart ref="chartRef" :width="600" :height="400" :axis="axis" :brush="brush" :render="false" />
  </div>
</template>
