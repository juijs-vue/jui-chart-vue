import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'
import type { Builder } from 'jui-graph-ts'

// Most tests below don't configure `tooltipFormat`, since the widget's line positioning/tooltip
// visibility/point coloring logic doesn't touch canvas at all. A dedicated test further down DOES
// configure `tooltipFormat` (reaching `drawContentTooltip()`'s `getTextWidth()`, which uses a real
// `<canvas>` 2D context - unimplemented in jsdom, this project's unit-test environment, so
// `getContext('2d')` returns `null` here) to cover `getTextWidth()`'s no-2D-context fallback - see
// `guideline.ts`'s own header comment.
function mountGuideline() {
  const wrapper = mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'range', domain: [0, 4], step: 1, line: true },
          y: { type: 'range', domain: [0, 10], line: true },
          data: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }],
        },
      ],
      brush: [{ type: 'line', target: ['v'] }],
      widget: [{ type: 'guideline', brush: 0, xFormat: (v: unknown) => `t:${v}` }],
    },
  })

  const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
  return { wrapper, builder }
}

describe('guideline widget', () => {
  it('starts hidden with a zero-position line and no content-tooltip data yet', () => {
    const { wrapper } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')
    expect(g).not.toBeNull()
    expect(g!.getAttribute('visibility')).toBe('hidden')
  })

  it('guideline.show moves the line to the snapped data-row position and makes the group visible', () => {
    const { wrapper, builder } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')!

    builder.emit('guideline.show', [2])

    expect(g.getAttribute('visibility')).toBe('visible')
    const line = g.querySelector('line')!
    // domain [0,4], 5 rows -> interval 0.8, time=2 -> index floor(2/0.8)=2.
    expect(line.getAttribute('x1')).not.toBe('0')
  })

  it('guideline.hide makes the group invisible again', () => {
    const { wrapper, builder } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')!

    builder.emit('guideline.show', [2])
    expect(g.getAttribute('visibility')).toBe('visible')

    builder.emit('guideline.hide', [])
    expect(g.getAttribute('visibility')).toBe('hidden')
  })

  it('colors the target point for a target present in the (default, un-toggled) legend_target cache', () => {
    const { wrapper, builder } = mountGuideline()
    const g = wrapper.element.querySelector('g.widget-guideline')!

    builder.emit('guideline.show', [2])

    const circles = g.querySelectorAll('circle')
    // At least the point-marker circle (created in drawBefore, positioned/colored by
    // drawContentTooltip) should have a real, non-transparent fill.
    const fills = Array.from(circles).map((c) => c.getAttribute('fill'))
    expect(fills.some((f) => f && f !== 'transparent')).toBe(true)
  })

  // Regression test for the `getTextWidth()` crash: jsdom's `HTMLCanvasElement.getContext('2d')`
  // returns `null` (no real canvas 2D context implementation - see `guideline.ts`'s own header
  // comment), and `getTextWidth()` used to dereference `context.font = font` with no null-check,
  // throwing `TypeError: Cannot set properties of null` the moment `widget.tooltipFormat` is
  // configured (the only caller of `getTextWidth()`, in `drawContentTooltip()`). This exercises
  // exactly that path in this project's real jsdom test environment (no mocking needed).
  it('does not throw when tooltipFormat is configured and the canvas 2D context is unavailable (jsdom)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 4], step: 1, line: true },
            y: { type: 'range', domain: [0, 10], line: true },
            data: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }],
          },
        ],
        brush: [{ type: 'line', target: ['v'] }],
        widget: [{ type: 'guideline', brush: 0, tooltipFormat: (data: unknown, key: string) => ({ key, value: (data as Record<string, unknown>)[key] }) }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()

    expect(() => builder.emit('guideline.show', [2])).not.toThrow()
  })
})
