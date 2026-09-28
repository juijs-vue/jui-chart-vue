// Smoke test (task step 4's own explicit ask): confirms `Builder` genuinely produces real SVG DOM
// under jsdom, mounted through `<Chart>`, the same way it would in a browser - and that unmounting
// tears the SVG back out again.
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { Builder } from 'jui-graph-ts'
import Chart from './Chart.vue'

describe('Chart.vue', () => {
  it('mounts and renders a real <svg> element into its root div, sized from props', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
      },
    })

    const svg = wrapper.element.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('width')).toBe('400')
    expect(svg!.getAttribute('height')).toBe('300')
  })

  it('re-renders (a fresh Builder + fresh <svg>) when props change reactively', async () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
      },
    })

    const firstSvg = wrapper.element.querySelector('svg')
    expect(firstSvg).not.toBeNull()

    await wrapper.setProps({ width: 500 })

    const svgs = wrapper.element.querySelectorAll('svg')
    // remount() clears the root's innerHTML before building fresh, so there should still be
    // exactly one <svg>, now sized from the new prop.
    expect(svgs.length).toBe(1)
    expect(svgs[0].getAttribute('width')).toBe('500')
  })

  it('clears the root element on unmount (Core.destroy() is an intentional no-op)', () => {
    const wrapper = mount(Chart, {
      props: { axis: [{ data: [] }] },
    })

    const el = wrapper.element as HTMLElement
    expect(el.querySelector('svg')).not.toBeNull()

    wrapper.unmount()

    expect(el.querySelector('svg')).toBeNull()
  })

  it('defaults to the registered "classic" theme (renders without an unregistered-theme error)', () => {
    expect(() =>
      mount(Chart, {
        props: { axis: [{ data: [] }] },
      }),
    ).not.toThrow()
  })

  // Regression test for two compounding, real bugs found while investigating why
  // `play/chart/json/mixed3_axis_3.js`'s candlestick/column brushes never rendered anything: the
  // "mount an axis with no data, then fill it in later via `getBuilder().axis(i).update(...)`/
  // `.zoom(...)`, finishing with an explicit `builder.render(true)`" pattern (documented at length
  // in `remount()`'s own `cloneForEngine()` doc comment above).
  it('keeps an imperative axis(i).update()/.zoom()/render(true) sequence visible - does not silently self-undo via a spurious extra remount, and does not mutate the caller\'s reactive padding prop', async () => {
    const dataSource = [
      { date: new Date(1994, 2, 1), l: 24.0, h: 25.0, o: 25.0, c: 24.875 },
      { date: new Date(1994, 2, 2), l: 23.625, h: 25.125, o: 24.0, c: 24.875 },
      { date: new Date(1994, 2, 3), l: 26.25, h: 28.25, o: 26.75, c: 27.0 },
      { date: new Date(1994, 2, 4), l: 26.5, h: 27.875, o: 26.875, c: 27.25 },
    ]

    // Deliberately PARTIAL (only `bottom`, matching `mixed3_axis_3.js`'s own `padding: { bottom:
    // 60 }`) - `Builder.setup()`'s own `padding` default has all four sides, and the underlying
    // engine's `Core.mergeOptions()` fills in whichever of them a caller's `options.padding` object
    // is missing, IN PLACE - the exact mutation this test guards against leaking back into `props`.
    const paddingProp = { bottom: 60 }

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        padding: paddingProp,
        axis: [
          {
            x: { type: 'block', domain: 'date', hide: true },
            y: { type: 'range', domain: [20, 30], step: 5, line: true },
            keymap: { low: 'l', high: 'h', open: 'o', close: 'c' },
          },
        ],
        brush: [{ type: 'candlestick', target: ['l', 'h', 'o', 'c'], axis: 0 }],
      },
    })

    const builder: any = (wrapper.vm as any).getBuilder()
    const builderIndexBefore = builder.index

    builder.axis(0).update(dataSource)
    builder.axis(0).zoom(1, 3)
    builder.render(true)

    // The deep `watch(assembledOptions, remount, { deep: true })` fires on its own schedule (a
    // real prop mutation, if any leaked through, wouldn't be visible until this flushes).
    await flushPromises()

    // Bug #1 (Chart.vue): `remount()` used to hand the engine a live reference to this exact
    // reactive `padding` prop object - `Core.mergeOptions()` would then mutate it in place (adding
    // `top`/`left`/`right`), which retriggered the deep watcher and rebuilt the Builder from
    // scratch, discarding the update()/zoom() above. Asserted two ways: the caller's own object is
    // untouched, and the SAME Builder instance (not a fresh one) is still live.
    expect(paddingProp).toEqual({ bottom: 60 })
    expect((wrapper.vm as any).getBuilder()).toBe(builder)
    expect(builder.index).toBe(builderIndexBefore)

    // The actual visible symptom: real candlestick shapes (not just the empty <g>).
    const candleGroup = wrapper.element.querySelector('g.brush-candlestick')
    expect(candleGroup).not.toBeNull()
    expect(candleGroup!.querySelectorAll('rect,line').length).toBeGreaterThan(0)
  })

  // Bug #2 (Chart.vue): an unpassed `boolean`-typed prop resolves to `false` under Vue's own prop
  // defaulting rules, NOT `undefined` - so `render` (forwarded to `Builder`'s own `render` option,
  // whose `Builder.setup()` default is `true`) silently ended up `false` for every demo that never
  // explicitly writes `:render="..."` at all, defeating `Axis.update()`/`.zoom()`/etc.'s own
  // `if (this.chart.isRender()) this.chart.render()` auto-render guard. Confirmed against
  // `play/chart/json/brush_axis_value.js`'s own real pattern: only `getBuilder().axis(0).update(
  // data)` in `mounted()`, relying entirely on that guard, no explicit trailing `render()` call.
  it('auto-renders after axis(0).update() with no explicit render prop and no explicit trailing render() call', async () => {
    const data = [
      { quarter: '1Q', sales: 2100, profit: 1800 },
      { quarter: '2Q', sales: 6000, profit: 4400 },
      { quarter: '3Q', sales: 8300, profit: 6700 },
      { quarter: '4Q', sales: 5200, profit: 4800 },
    ]

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: 'quarter', line: true },
            y: { type: 'range', domain: [0, 10000], step: 4, line: true },
          },
        ],
        brush: [{ type: 'bubble', target: ['sales', 'profit'] }],
      },
    })

    const builder: any = (wrapper.vm as any).getBuilder()
    expect(builder.options.render).toBe(true)

    builder.axis(0).update(data)
    await flushPromises()

    expect(wrapper.element.querySelectorAll('circle').length).toBeGreaterThan(0)
  })

  // Regression test for a reported bug (`play/chart/json/update_axis_grid.js`'s own pattern):
  // "mounted once with `render: false` triggers `Builder.render()` FIVE times, producing transient
  // `<ellipse cx="null">` SVG errors" (expected: exactly 2 - the one mandatory call
  // `Builder.init()` always makes at mount regardless of `render`, plus the one explicit trailing
  // `builder.render()` below; `Axis.set()`/`updateGrid()`'s own `if (this.chart.isRender())
  // this.chart.render()` guard should suppress both `updateGrid()` calls in between, since
  // `isRender()` consults `_options.render` - `false` here - once `_initialize` is `true`).
  // NOT REPRODUCIBLE against this project's current code (see `UpdateAxisGridSample.vue`'s own
  // header comment for the full investigation, including real-browser/Playwright confirmation -
  // jsdom can't validate SVG attributes the way a real renderer does, so it wouldn't reproduce the
  // reported `<ellipse>` warnings even if the call-count bug were still present here) - this test
  // exists as a permanent guard against the count regressing back to something other than 2,
  // whatever the eventual root cause of the originally-reported discrepancy turns out to be.
  it('calls Builder.render() exactly twice for a render:false mount + two axis(0).updateGrid() calls + one explicit render()', async () => {
    const renderSpy = vi.spyOn(Builder.prototype, 'render')
    renderSpy.mockClear()

    const wrapper = mount(Chart, {
      props: {
        width: 600,
        height: 400,
        axis: [
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
        ],
        brush: [{ type: 'scatter', target: ['sales', 'profit'] }],
        render: false,
      },
    })

    expect(renderSpy).toHaveBeenCalledTimes(1)

    const builder: any = (wrapper.vm as any).getBuilder()
    const axis0 = builder.axis(0)

    axis0.updateGrid('y', { type: 'block', domain: ['1Q', '2Q', '3Q', '4Q'], line: true }, true)
    axis0.updateGrid('x', { type: 'range', domain: [0, 10000], step: 4 }, true)
    await flushPromises()

    // The two updateGrid() calls above must NOT have triggered a render (render:false, and no
    // reactive prop change occurred - a spurious remount would also show up here as extra calls).
    expect(renderSpy).toHaveBeenCalledTimes(1)

    builder.render()

    expect(renderSpy).toHaveBeenCalledTimes(2)

    // Same final-state check as the legacy demo's own visual intent: a real, non-empty scatter
    // brush, not a crashed/empty one.
    expect(wrapper.element.querySelectorAll('g.brush-scatter ellipse').length).toBeGreaterThan(0)

    renderSpy.mockRestore()
  })
})
