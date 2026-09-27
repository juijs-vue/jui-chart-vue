# jui-chart-vue

A native Vue 3 `<Chart>` component built on [jui-graph-ts](https://github.com/juijs-vue/jui-graph-ts)'s
real `Builder`/`Axis` rendering engine — every brush, widget and theme
[jui-chart](https://github.com/juijs/jui-chart) ships, as plain reactive props instead of a jQuery
selector and a `chart.builder(selector, options)` factory call.

## Install

```bash
npm install jui-chart-vue
```

## Usage

```vue
<script setup>
import { Chart } from "jui-chart-vue"
import "jui-chart-vue/style.css"

const axis = [
    {
        x: { type: "block", domain: "quarter", line: true },
        y: { type: "range", domain: [0, 100], step: 10, line: true },
        data: [
            { quarter: "1Q", sales: 50 },
            { quarter: "2Q", sales: 80 }
        ]
    }
]
const brush = [{ type: "column", target: ["sales"] }]
</script>

<template>
    <Chart :axis="axis" :brush="brush" theme="classic" />
</template>
```

Where the legacy library takes one big `options` object, `<Chart>` splits it into individual props -
`axis` / `brush` / `widget` / `theme` / `style` / `width` / `height` / `padding` / `canvas` / `event` /
`render` / `icon` - same shape underneath, just typed and reactive: change any prop and the chart
re-renders. A `type` string (`"bar"`, `"stackcolumn3d"`, `"canvas.scatter3d"`, `"map.marker"`, ...) is
unchanged from jui-chart itself, so existing `axis`/`brush`/`widget` config objects carry over as-is.

For imperative access to the live engine instance (`axis(i).update(...)`, `.zoom(...)`,
`.setTheme(...)`, `.on(...)`, matching jui-chart's own `chart.builder` instance API), take a template
ref and call `getBuilder()`:

```vue
<script setup>
import { ref, onMounted } from "vue"
import { Chart } from "jui-chart-vue"

const chartRef = ref()
onMounted(() => chartRef.value.getBuilder().axis(0).update(newData))
</script>

<template><Chart ref="chartRef" :axis="axis" /></template>
```

## Brushes, widgets & themes

81 brushes, 18 widgets and 5 themes are pre-registered (`src/register/`) - everything jui-chart itself
ships, reimplemented against `jui-graph-ts`'s engine via its `registerBrush`/`registerWidget`/
`registerTheme` extension points. Nothing needs registering by hand; importing `jui-chart-vue` at all
registers every type as a side effect.

## Development

This repo also holds the original jQuery-based `jui-chart` source (`src/brush/`, `src/widget/`,
`src/theme/`, `examples/`, `test/`) alongside the Vue port built from it - `src/register/` is a
from-scratch reimplementation of each brush/widget/theme against `jui-graph-ts`, using that original
source as the reference for exact geometry/behavior, not a thin wrapper around it.

```bash
npm install
npm run dev        # playground app
npm run test       # vitest (240+ tests)
npm run build:lib  # build the publishable package into dist-lib/
```

## License

MIT
