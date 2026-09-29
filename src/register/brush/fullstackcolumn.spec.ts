import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('fullstackcolumn brush', () => {
  it('always fills the full axis height regardless of the row sum (100%-normalized), stacked bottom-up', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 25, b: 75 }],
          },
        ],
        brush: [{ type: 'fullstackcolumn', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullstackcolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(2)

    const totalHeight = Array.from(rects).reduce((sum, r) => sum + Number(r.getAttribute('height')), 0)
    const axisHeight = 300 - 50 - 50 // default 50px chart padding both sides, no axis-level padding
    expect(Math.abs(totalHeight - axisHeight)).toBeLessThan(1)
  })

  it("a single NaN-height segment (target value 0 in a row whose sum is also 0) doesn't poison startY for the rest of that row's segments", () => {
    // Row sum = 10 + (-10) + 0 = 0, so the 'c' segment's own rate() computes 0/0 = NaN. The other
    // two segments ('b' at -10 and 'a' at 10) have perfectly valid, independently-finite heights
    // (clamped by the y-axis rate() to 0 and to the full axis height respectively) - they must
    // still get real geometry, not be blanked out just because 'c' (processed first, since j counts
    // down from list.length - 1) poisoned the running startY total.
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'range', domain: [0, 100] },
            data: [{ name: 'A', a: 10, b: -10, c: 0 }],
          },
        ],
        brush: [{ type: 'fullstackcolumn', target: ['a', 'b', 'c'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-fullstackcolumn')
    expect(group).not.toBeNull()

    const rects = group!.querySelectorAll('rect')
    expect(rects.length).toBe(3)

    // Draw order is j = list.length - 1 downto 0, i.e. 'c' (j=2), then 'b' (j=1), then 'a' (j=0) -
    // so the DOM order of the appended rects is [c, b, a].
    const [cRect, bRect, aRect] = Array.from(rects)

    // 'c''s own height is legitimately NaN (0/0) - it's correctly left without geometry.
    expect(cRect.getAttribute('height')).toBeNull()

    // 'b' and 'a' have genuinely finite heights of their own and must not be blanked out by 'c''s
    // NaN poisoning startY.
    for (const rect of [bRect, aRect]) {
      expect(rect.getAttribute('x')).not.toBeNull()
      expect(rect.getAttribute('y')).not.toBeNull()
      expect(rect.getAttribute('width')).not.toBeNull()
      expect(rect.getAttribute('height')).not.toBeNull()
      expect(Number.isFinite(Number(rect.getAttribute('x')))).toBe(true)
      expect(Number.isFinite(Number(rect.getAttribute('y')))).toBe(true)
      expect(Number.isFinite(Number(rect.getAttribute('width')))).toBe(true)
      expect(Number.isFinite(Number(rect.getAttribute('height')))).toBe(true)
    }

    expect(Number(bRect.getAttribute('height'))).toBeCloseTo(0)
    expect(Number(aRect.getAttribute('height'))).toBeCloseTo(200)
  })
})
