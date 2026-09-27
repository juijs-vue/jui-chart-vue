import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('splitarea brush', () => {
  it('draws a filled area <path> plus a line <path> (line: true, the default) per target, inside a <g class="brush-splitarea">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B', 'C'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value: 30 },
              { name: 'B', value: 60 },
              { name: 'C', value: 10 },
            ],
          },
        ],
        brush: [{ type: 'splitarea', target: ['value'], split: 1 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-splitarea')
    expect(group).not.toBeNull()

    // `drawArea()` appends the (1 or 2-<path>) filled-area line group, then - since `line: true` -
    // ANOTHER (1 or 2-<path>) plain line group on top, per target: split:1 crosses the boundary
    // once, so each of those two groups holds 2 <path>s -> 4 total.
    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(4)

    for (const p of paths) {
      expect(p.getAttribute('d')).toBeTruthy()
    }
  })

  it('line: false omits the extra plain-line overlay, leaving only the filled-area path(s)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value: 30 },
              { name: 'B', value: 60 },
            ],
          },
        ],
        brush: [{ type: 'splitarea', target: ['value'], line: false }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-splitarea')!
    const paths = group.querySelectorAll('path')
    // no split configured -> 1 area <path>, no line overlay
    expect(paths.length).toBe(1)
  })

  it('with no data at all (real usage: a realtime chart before its first data update), draws no malformed path - just an empty group, no <path d> containing "undefined"', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ x: { type: 'block', domain: [] }, y: { type: 'range', domain: [0, 100] }, data: [] }],
        brush: [{ type: 'splitarea', target: ['value'], split: 5 }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-splitarea')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    for (const p of paths) {
      expect(p.getAttribute('d') ?? '').not.toContain('undefined')
    }
  })

  it('setup() defaults symbol:"normal", split:null, line:true (line is new over the inherited splitline defaults)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'block', domain: ['A'] }, y: { type: 'range', domain: [0, 100] }, data: [{ name: 'A', value: 10 }] }],
        brush: [{ type: 'splitarea', target: ['value'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.symbol).toBe('normal')
    expect(brush.split).toBeNull()
    expect(brush.line).toBe(true)
  })
})
