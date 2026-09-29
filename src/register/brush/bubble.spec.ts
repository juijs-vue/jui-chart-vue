import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('bubble brush', () => {
  it('renders one <circle> per data point, radius scaled between brush.min and brush.max', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 50 },
              { name: 'C', value1: 100 },
            ],
          },
        ],
        brush: [{ type: 'bubble', target: ['value1'], min: 5, max: 30 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-bubble')
    expect(group).not.toBeNull()

    const circles = group!.querySelectorAll('circle')
    expect(circles.length).toBe(3)

    const radii = Array.from(circles).map((c) => Number(c.getAttribute('r')))
    // Without an explicit `scaleKey`, the radius domain is the y-axis's own resolved [min,max]
    // (here [0,100], matching the data's own full range) - `scaleValue(value, 0, 100, 5, 30)`.
    // value=10 -> 5 + (10/100)*25 = 7.5; value=100 -> 30 (the configured max).
    expect(radii[0]).toBeCloseTo(7.5, 1)
    expect(radii[2]).toBeCloseTo(30, 0)
    expect(radii[1]).toBeGreaterThan(radii[0])
    expect(radii[1]).toBeLessThan(radii[2])
  })

  it('uses scaleKey (a different field) to drive radius when configured', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10, population: 1 },
              { name: 'B', value1: 90, population: 99 },
            ],
          },
        ],
        brush: [{ type: 'bubble', target: ['value1'], min: 5, max: 30, scaleKey: 'population' }],
      },
    })

    const circles = wrapper.element.querySelectorAll('g.brush-bubble circle')
    const radii = Array.from(circles).map((c) => Number(c.getAttribute('r')))
    // Row A has the LOWER value1 (10) but its `population` (1) is the min of the scaleKey field,
    // so it should still get the SMALLEST radius (matching the scaleKey field's own order, not
    // value1's) - here they happen to agree in direction, but the key point is scaleKey drives it.
    expect(radii[0]).toBeCloseTo(5, 0)
    expect(radii[1]).toBeCloseTo(30, 0)
  })

  it('does not throw when `active` is set with the default showText: false (setActiveEffect() must ' +
    "not restyle a text-label child that createBubble() never appended)", () => {
    let wrapper: ReturnType<typeof mount> | undefined

    expect(() => {
      wrapper = mount(Chart, {
        props: {
          width: 400,
          height: 300,
          axis: [
            {
              x: { type: 'block', domain: ['A', 'B'] },
              y: { type: 'range', domain: [0, 100] },
              data: [
                { name: 'A', value1: 10 },
                { name: 'B', value1: 90 },
              ],
            },
          ],
          brush: [{ type: 'bubble', target: ['value1'], active: 0 }],
        },
      })
    }).not.toThrow()

    const circles = wrapper!.element.querySelectorAll('g.brush-bubble circle')
    expect(circles.length).toBe(2)
    // setActiveEffect() ran without throwing and restyled the active bubble's own <circle> to full
    // opacity (its would-be text-label child, which showText: false never created, is left alone).
    expect(Number(circles[0].getAttribute('opacity'))).toBeCloseTo(1)
  })

  it('does not throw when `activeEvent` fires with the default showText: false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 10 },
              { name: 'B', value1: 90 },
            ],
          },
        ],
        brush: [{ type: 'bubble', target: ['value1'], activeEvent: 'click' }],
      },
    })

    const circles = wrapper.element.querySelectorAll('g.brush-bubble circle')
    expect(circles.length).toBe(2)
    expect(() => circles[0].dispatchEvent(new Event('click', { bubbles: true }))).not.toThrow()
  })
})
