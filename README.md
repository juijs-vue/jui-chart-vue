# jui-chart-vue

A native Vue 3 `<Chart>` component built on [jui-graph-ts](https://github.com/juijs-vue/jui-graph-ts)'s
real `Builder`/`Axis` rendering engine, covering 81 chart brushes, 18 widgets and 5 themes.

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

`<Chart>` takes `axis`, `brush`, `widget`, `theme`, `style`, `width`, `height`, `padding`, `canvas`,
`event`, `render` and `icon` as individual reactive props - change any of them and the chart
re-renders.

For imperative access to the live engine instance (`axis(i).update(...)`, `.zoom(...)`,
`.setTheme(...)`, `.on(...)`), take a template ref and call `getBuilder()`:

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

81 brushes, 18 widgets and 5 themes are pre-registered (`src/register/`) via `jui-graph-ts`'s
`registerBrush`/`registerWidget`/`registerTheme` extension points. Nothing needs registering by hand;
importing `jui-chart-vue` at all registers every type as a side effect.

## Development

```bash
npm install
npm run dev        # playground app
npm run test       # vitest (240+ tests)
npm run build:lib  # build the publishable package into dist-lib/
```

## License

MIT
