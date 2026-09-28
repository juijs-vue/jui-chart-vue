<script setup lang="ts">
// The single public entry point (PLAN.md's Phase 1 architecture): assembles axis/brush/widget/
// theme/style/width/height/padding props into the plain options object `jui-graph-ts`'s `Builder`
// expects, then lets `Builder`'s real engine do 100% of the rendering (imperative DOM, not a Vue
// template) - `<template>` below really is just the one `<div ref="rootEl" />`.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Builder } from 'jui-graph-ts'
import { GRID_TYPES } from './register/setup'
import { ChartBuilder } from './register/chartMap'

export interface AxisPadding {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export interface AxisConfig {
  x?: Record<string, unknown> | null
  y?: Record<string, unknown> | null
  z?: Record<string, unknown> | null
  c?: Record<string, unknown> | null
  map?: Record<string, unknown> | null
  area?: Record<string, unknown>
  padding?: number | AxisPadding
  extend?: number | null
  data?: unknown[]
  keymap?: Record<string, string>
  [key: string]: unknown
}

export interface BrushConfig {
  type: string
  axis?: number
  target?: string[] | string
  colors?: unknown
  [key: string]: unknown
}

export interface WidgetConfig {
  type: string
  axis?: number
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    /** Forwarded to `Builder`'s own `width` option (`Builder.setup()`'s default: `"100%"`, i.e. the
     * root `<div>`'s own measured width). An integer number renders the chart at exactly that many
     * px regardless of the container's real size (`Builder.getCanvasRealSize()`'s own
     * `typeCheck("integer", ...)` check); a string (e.g. `"100%"`, `"600px"`) is applied as CSS on
     * the root element and the chart measures whatever that resolves to. */
    width?: number | string
    /** Forwarded to `Builder`'s own `height` option - same `number` (exact px) vs. `string` (CSS,
     * measured) split as `width`, defaulting to `"100%"`. */
    height?: number | string
    /** Forwarded to `Builder`'s own `padding` option (`Builder.setup()`'s default:
     * `{top:50,bottom:50,left:50,right:50}`) - a single number applies that value to all 4 sides,
     * an `AxisPadding` sets each side independently (unset sides fall back to the default, merged
     * in by `jui-graph-ts`'s own `skip:true` "only fill currently-undefined keys" option-merge, not
     * by this component). Defines the plot area's own inset from the chart's outer `width`/`height`
     * - axis labels, titles, and widgets like `legend`/`tooltip` are typically drawn in this
     * margin, not inside the plot area itself. */
    padding?: number | AxisPadding
    /** Forwarded to `Builder`'s own `axis` option (`Builder.setup()`'s default: `[]`) - one entry
     * per independent axis GROUP, each with its own `x`/`y`/`z`/`c`/`map` grid config and `data`
     * array. A single object is equivalent to a 1-element array. A brush/widget's own numeric
     * `axis` field (`BrushConfig`/`WidgetConfig` below) is the INDEX into this array it reads its
     * data/grids from - `0` (the default) when omitted, so a chart with only one axis group never
     * needs to set it explicitly on its brushes/widgets. */
    axis?: AxisConfig | AxisConfig[]
    /** Forwarded to `Builder`'s own `brush` option (`Builder.setup()`'s default: `[]`) - one entry
     * per drawn series/shape layer, rendered in array order (later entries draw on top). Each
     * entry's `type` must be a name registered via `jui-graph-ts`'s `registerBrush()` (see the
     * `jui-chart-vue (brush/widget/...)` reference section for the full list and each type's own
     * config fields on top of the `target`/`axis`/`colors`/`clip`/etc. shared by every brush - a
     * single object is equivalent to a 1-element array. */
    brush?: BrushConfig | BrushConfig[]
    /** Forwarded to `Builder`'s own `widget` option (`Builder.setup()`'s default: `[]`) - same
     * array-of-typed-configs shape as `brush` (a single object is equivalent to a 1-element array),
     * but for non-data-series overlays (titles, legends, tooltips, zoom/pan controls, ...). Each
     * entry's `type` must be registered via `jui-graph-ts`'s `registerWidget()` - see the
     * `jui-chart-vue (brush/widget/...)` reference section for the full list. */
    widget?: WidgetConfig | WidgetConfig[]
    /** Forwarded to `Builder`'s own `theme` option (`Builder.setup()`'s default: `"classic"`).
     * Either the name of a theme registered via `jui-graph-ts`'s `registerTheme()` (this project
     * ships `"classic"`/`"dark"`/`"gradient"`/`"pastel"`/`"pattern"` - see
     * `register/theme/types.ts`'s `ChartThemeOptions` for the full style-key reference) or a plain
     * style-value object in that same shape, merged over the active theme's own defaults (missing
     * keys fall back to whatever the base/named theme already set - see
     * `register/theme/types.ts`'s own header comment on why not every theme sets every key). */
    theme?: string | Record<string, unknown>
    /** Forwarded to `Builder`'s own `style` option (`Builder.setup()`'s default: `{}`) - a partial
     * style-key override on top of `theme`, same key space as `theme`'s own object form (see
     * `register/theme/types.ts`'s `ChartThemeOptions`). Useful for tweaking a few style keys
     * without redeclaring/copying a whole named theme's object. **Precedence depends on `theme`'s
     * own type, per `Builder.setThemeStyle()`**: when `theme` is a NAME (string), `style` wins over
     * that named theme's own values for any key both set; when `theme` is an inline OBJECT, it's
     * the other way around - `theme` wins over `style`, and the merge additionally starts from
     * whatever the chart's theme already was before this change (not a fresh reset). */
    style?: Record<string, unknown>
    /**
     * Forwarded to `Builder`'s own `render` option (`Builder.setup()`'s own default: `true` -
     * "auto re-render on every imperative `axis(i).update()`/`.zoom()`/`.next()`/`.prev()`/
     * `.screen()`/etc call"). Defaulted to `true` here EXPLICITLY (`withDefaults`, below) - a real,
     * previously-undocumented bug this closes: Vue's own prop-resolution casts an UNPASSED
     * `boolean`-typed optional prop to `false` (not `undefined`), never `Builder.setup()`'s actual
     * `true` default - so any demo that never explicitly writes `:render="..."` at all (the common
     * case; `render` is normally only ever set to `false` deliberately, for the "mount without
     * data, then fill it in later via `getBuilder().axis(i).update(...)`" pattern) used to end up
     * with the OPPOSITE of the engine's real default: `Axis.update()`/`.zoom()`/etc's own `if
     * (this.chart.isRender()) this.chart.render()` auto-render guard silently never fired for ANY
     * demo, "render:false" or not. Confirmed against `play/chart/json/brush_axis_value.js` (calls
     * only `getBuilder().axis(0).update(data)` in `mounted()`, no explicit trailing `render()` -
     * exactly the pattern this default-mismatch breaks): the bubble brush drew zero circles on the
     * live site despite `axis(0).data` correctly holding the 4 real rows, purely because
     * `builder.options.render` was `false`. A demo (like `mixed3_axis_3.js`) that follows its own
     * imperative calls with an explicit `b.render(true)` was masked from this particular symptom
     * (that unconditional call doesn't consult `isRender()` at all) - but still silently lost the
     * engine's own intended default behavior for every OTHER imperative call in between.
     */
    render?: boolean
    /**
     * Forwarded to `Builder`'s own `icon` option (`{ type, path }` - `Builder.setup()`'s default is
     * `{ type: 'classic', path: null }`). `path` is what `Builder.setVectorFontIcons()` needs to
     * actually inject a real `@font-face` rule (a string or array of font file URLs) - WITHOUT it,
     * `chart.text()`'s `{key}`-style icon placeholders (`parseIconInText()`) still resolve to real
     * Private-Use-Area codepoints (via `registerIcon('classic', ...)`, always registered - see
     * `register/icon/classic.ts`), but those codepoints render as invisible/"tofu" glyphs with no
     * font backing them. Left unset, this component defaults `path` to this project's own bundled
     * `public/fonts/icomoon.*` files (copied verbatim from the legacy `images/icon/` directory) - a
     * working default is more useful than a footgun for the common case; pass `icon` explicitly to
     * override (e.g. a different font, or `path: null` to opt out of the `@font-face` injection
     * entirely while keeping the `classic` codepoint map registered).
     *
     * OPEN ISSUE, NOT FIXED (flagged, not being actively investigated further for now): in real
     * Chromium, icon glyphs may still render as "tofu" boxes despite the font loading successfully,
     * the `@font-face` rule being present exactly once in `document.head`, and the CSS `font-family`
     * cascade resolving correctly (`classic` in the stack) - every layer independently verified
     * correct except the final glyph paint. A prior investigation attributed this to
     * `Builder.setVectorFontIcons()`'s specific CSS-injection technique and "fixed" it by changing
     * that technique - a LATER, more rigorous re-test disproved that diagnosis (the technique was
     * never the real differentiator; that was a confounded test). The true root cause is unknown -
     * see `register/icon/classic.ts`'s header comment for the full history.
     */
    icon?: { type: string; path?: string | string[] | null }
    /**
     * Forwarded to `Builder`'s own `canvas` option (`Builder.setup()`'s default: `false`). Required
     * for any `chart.brush.canvas.*`/`chart.widget.canvas.*`-family type (`canvas.activebubble`,
     * `canvas.picker`, etc.) to actually get a real `<canvas>` element/2D context wired onto
     * `draw.canvas` - see `base/builder.ts`'s `init()`/`initCanvasElement()`. Without it, `Builder`
     * never creates the `main`/`buffer`/`sub` canvases at all and any canvas-family brush/widget's
     * `this.canvas` stays `null`.
     */
    canvas?: boolean
    /** Forwarded to `Builder`'s own `event` option - top-level chart events (e.g. `click`, bound by
     * `Core.mount()` via `on(key, handler)` for each entry) as opposed to a specific brush/widget's
     * own `event` sub-option (already passed through untouched inside `brush`/`widget` array items). */
    event?: Record<string, (...args: unknown[]) => unknown>
  }>(),
  { render: true },
)

/** `import.meta.env.BASE_URL` (Vite's own configured `base`, `/` by default) rather than a bare
 * `/fonts/...` literal, so these URLs stay correct if this app is ever deployed under a sub-path
 * (e.g. GitHub Pages) - the exact same portability concern any other Vite-served static asset has. */
const DEFAULT_ICON_FONT_PATHS = ['icomoon.eot', 'icomoon.woff', 'icomoon.ttf', 'icomoon.svg'].map((f) => `${import.meta.env.BASE_URL}fonts/${f}`)

const rootEl = ref<HTMLDivElement>()
let builder: Builder | null = null
// Vue nulls out a template ref (`rootEl.value`) as part of tearing down the DOM during unmount,
// which can happen before `onUnmounted` callbacks run - captured separately here so the cleanup
// below can still reach the real element instead of silently no-op'ing on a null ref.
let mountedEl: HTMLDivElement | null = null

const assembledOptions = computed(() => ({
  width: props.width,
  height: props.height,
  padding: props.padding,
  axis: props.axis,
  brush: props.brush,
  widget: props.widget,
  theme: props.theme,
  style: props.style,
  render: props.render,
  icon: props.icon ?? { type: 'classic', path: DEFAULT_ICON_FONT_PATHS },
  canvas: props.canvas,
  event: props.event,
}))

/**
 * Structural deep clone of whatever `assembledOptions.value` holds, EXCEPT functions/`Date`s
 * (kept by reference - they're either callbacks the engine must still be able to call, like
 * `event`/widget `format`, or opaque values `jui-graph-ts` never mutates in place). Mirrors
 * `jui-graph-ts`'s own internal `deepClone()` (`base/builder.ts`) shape/behavior, reimplemented
 * here rather than imported since it isn't part of that package's public API.
 *
 * **Why this exists - a real, previously-undocumented bug this fix closes**: `assembledOptions`'s
 * `padding`/`axis`/`brush`/`widget`/`style`/`event` fields are `props.xxx` DIRECTLY (no cloning) -
 * for an Options-API demo (`data() { return { padding: {...}, axis: [...] } }`), these are
 * genuinely deep-REACTIVE Vue objects (Vue 3 recursively `reactive()`-ifies a component's own
 * `data()` return value), and the SAME object identity is handed straight through as the prop
 * value. `remount()` used to pass `assembledOptions.value` (carrying those live reactive
 * references) directly into `Builder.mount()` - but `jui-graph-ts`'s own `Core.mergeOptions()`
 * (`base/core.ts`) MUTATES its `options` argument IN PLACE (a faithful port of the original
 * engine's own `utility.extend(options, defOpts, true)` mutate-in-place convention), filling in
 * any keys a level's `static setup()` defaults but the caller left unset - e.g. `Builder.setup()`'s
 * `padding: {top:50,bottom:50,left:50,right:50}` default, merged with `skip:true` ("only fill
 * currently-`undefined` keys") into whatever `options.padding` already is. For a demo that passes
 * an already-object-shaped-but-PARTIAL `padding` (e.g. `padding: { bottom: 60 }`, exactly
 * `play/chart/json/mixed3_axis_3.js`'s own config), that merge doesn't create a new object - it
 * WRITES the missing `top`/`left`/`right` keys directly onto the live `props.padding` object,
 * since that's the exact same reference `options.padding` aliases.
 *
 * Two real, compounding consequences, Playwright/vitest-confirmed against the live site, not
 * just inferred: (1) the user's own reactive `padding` prop is silently corrupted (gains
 * `top`/`left`/`right` keys it never had) the moment the chart first mounts; (2) far worse, this
 * `chart-tab-app`-style component's own `watch(assembledOptions, remount, { deep: true })` below
 * had ALREADY deep-traversed `props.padding` once (at `watch()`-registration time, during this
 * component's own `setup()`) to collect its reactive dependencies - and Vue's deep-reactivity
 * bookkeeping treats adding a brand-new key to an already-tracked reactive object as a real
 * "ADD" mutation, which invalidates ANY effect (including this exact watcher) that previously
 * enumerated that object's keys. The watcher fires again, calling `remount()` a SECOND time -
 * tearing down the just-built `Builder` and constructing a completely fresh one from the ORIGINAL,
 * static `axis`/`brush` prop config. For `mixed3_axis_3.js`'s own "mount without data, then fill
 * it via `getBuilder().axis(0).update(dataSource)`/`.zoom(start,end)` in `mounted()`" pattern, this
 * second, spurious remount happens on the very next microtask AFTER that imperative fill already
 * ran - silently discarding it (the brush ends up rendering ZERO shapes: its `axis.data` is back
 * to the static, empty-array default, not the real data the demo just loaded) - even though
 * NEITHER the demo's own `mounted()` code NOR any later widget/event ever intentionally reassigns
 * any prop. Confirmed via Playwright against the real running site (an `Error.stackTraceLimit`
 * bump plus a `watch(..., { onTrigger })` probe traced the retrigger to exactly this `padding.top`/
 * `.left`/`.right` "add", not to anything the demo's own code does) - not merely reasoned about.
 * The SAME mechanism would corrupt/re-trigger on ANY other object-shaped, partially-specified
 * top-level option this component forwards by live reference (`style`, a user-supplied `icon`) -
 * `padding` is simply the one real demo corpus scan (`play/chart/json/*.js`) actually hits, since
 * `Builder.setup()`'s own `style: {}` default has no keys of its own to ever add.
 *
 * The fix, entirely on this side of the `jui-graph-ts` boundary (that package's own mutate-in-place
 * option-merge convention is a deliberate, 1:1-ported original-engine behavior this project must
 * not change - see `base/core.ts`'s own `mergeOptions()` doc comment): never hand the engine a
 * live reference to a Vue-reactive prop value it might mutate. `remount()` now clones
 * `assembledOptions.value` at this exact boundary before it ever reaches `Builder.mount()` - the
 * engine is free to mutate its own private copy however its own option-merge/`reload()`/`update()`
 * machinery normally does (unaffected otherwise), while `props.padding` (and everything else) stays
 * exactly what the user passed, and the deep watcher below - which still tracks the REAL,
 * unmutated `props.*` objects, correctly - never sees a spurious change to react to.
 *
 * `data`/`origin` keys are deliberately EXEMPTED from this clone (kept by reference, at ANY nesting
 * depth) - matching `jui-graph-ts`'s OWN internal `deepClone(this.options, { data: true, bind: true
 * })`/`deepClone(this._options.axis, { data: true, origin: true })` calls (`base/builder.ts`'s
 * `setDefaultOptions()`/`drawAxis()`), which never clone an axis's `data` either, for the same
 * reason: several real, already-registered brushes (the `canvas.dot3d`/etc 3D family) intentionally
 * mutate a data ROW in place (e.g. padding a 2-element `[x,y]` row to `[x,y,0]`) as a documented
 * side effect callers rely on being able to observe on their OWN array - cloning `data` here would
 * silently make the engine mutate an inert copy instead. It also preserves the OTHER, declarative
 * pattern this project's own realtime demos already committed to (mutating `axis[i].data` reactively
 * in place, e.g. `.push()`, and letting the deep watcher below pick that real change up naturally) -
 * unaffected either way, since that path never touches `Core.mergeOptions()`'s mutate-in-place merge
 * at all.
 */
function cloneForEngine<T>(value: T, keyInParent?: string): T {
  if (keyInParent === 'data' || keyInParent === 'origin') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneForEngine(item)) as unknown as T
  }
  if (value instanceof Date) {
    return value
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key in value as Record<string, unknown>) {
      out[key] = cloneForEngine((value as Record<string, unknown>)[key], key)
    }
    return out as T
  }
  // Primitives AND functions (e.g. `event`/widget `format`/`domain` callbacks) - kept by
  // reference, matching `jui-graph-ts`'s own `deepClone()` fallback for anything that isn't an
  // array/`Date`/plain object.
  return value
}

/**
 * `jui-graph-ts`'s `Builder` has no `reload(options)` method (verified by reading `base/builder.ts`
 * in full - only `Axis` has one) and its own incremental `addBrush`/`removeBrush`/`updateBrush`/
 * `addWidget`/`removeWidget`/`updateWidget`/`setTheme`/`setSize` don't support wholesale-replacing
 * the `axis`/`brush`/`widget` arrays the way a reactive prop change needs to. The pragmatic,
 * faithful approach: tear down the root element's DOM ourselves and construct a completely fresh
 * `Builder` from scratch on every (re)mount - re-running the full init/render pipeline, exactly as
 * a first mount would.
 */
function remount(): void {
  const el = rootEl.value
  if (!el) return

  el.innerHTML = ''
  mountedEl = el

  // `ChartBuilder` (not `jui-graph-ts`'s own `Builder` directly) - its own `mount()` override
  // pre-processes any `axis[].map` config through `preprocessMapAxis()`/`createMapConfig()`
  // (`./register/chartMap.ts`'s own header comment has the full "two compounding, already-ported-
  // code bugs" writeup for why this is necessary at all) - the SAME fix `index.ts`'s own
  // re-exported `Builder` applies, so both real entry points into this project's engine (this
  // component AND www.jui-vue.io's own legacy `chart.builder` shim, which uses that re-export
  // directly and never goes through `<Chart>`/Vue at all) get it.
  const b: Builder = new ChartBuilder()
  // `Builder` never declares/populates `gridTypes` itself (see `register/gridTypes.ts`'s header
  // comment) - stamped on directly before `.mount()`, since `mount()` renders synchronously.
  Object.assign(b, { gridTypes: GRID_TYPES })
  // See `cloneForEngine()`'s own doc comment above - never hand the engine a live reference to a
  // Vue-reactive prop value.
  b.mount(el, cloneForEngine(assembledOptions.value) as never)

  builder = b
}

onMounted(remount)

watch(assembledOptions, remount, { deep: true })

onUnmounted(() => {
  // `Core.destroy()` is an intentional no-op in `jui-graph-ts` (documented at length in
  // `base/core.ts` - a preserved-structure-not-preserved-effect port of a bug that only mattered
  // under the original's shared-prototype registry). Clear the root element ourselves instead.
  if (mountedEl) mountedEl.innerHTML = ''
  mountedEl = null
  builder = null
})

defineExpose({
  /** Escape hatch for tests/advanced use - the live `Builder` instance backing this render. */
  getBuilder: () => builder,
})
</script>

<template>
  <div ref="rootEl" class="jui-chart"></div>
</template>

<style scoped>
/* `Builder.setup()` defaults `width`/`height` to the string `"100%"`, which the underlying SVG
 * element resolves against ITS OWN parent - this wrapper div. Without an explicit size of its own,
 * a plain <div> has no intrinsic height, so that "100%" silently collapses to the SVG's content
 * height (visibly wrong: a squashed chart) instead of stretching to fill whatever real container
 * (e.g. `#result`) this component was placed in. Consumers that pass explicit numeric `width`/
 * `height` props aren't affected either way, since the SVG then gets literal pixel attributes. */
.jui-chart {
  width: 100%;
  height: 100%;
}
</style>
