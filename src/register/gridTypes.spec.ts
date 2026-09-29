// Confirms `GRID_TYPES` (this directory's own `gridTypes.ts`) actually registers every grid type
// it claims to - specifically `"rule"` (`jui-graph-ts`'s `RuleGrid`, `src/grid/rule.ts`), which was
// previously omitted here entirely (unreachable in this Vue ecosystem despite being a real grid
// type in `jui-graph-ts`) BOTH because it was missing from this map AND because the underlying
// class itself used to crash on every real code path (all fixed now - see `rule.ts`'s own header
// comment in `jui-graph-ts` for the four Tier A fixes: `draw()`, `initDomain()`'s default path,
// `axisLine()`, and the multi-element-array-domain `NaN` bug).
//
// Same "mount <Chart>, assert it renders without throwing" smoke-test pattern `Chart.spec.ts`/
// `register/brush/stackcolumn.spec.ts` already establish - not a full visual/gallery demo (out of
// this task's scope, per its own instructions), just confirming the registration wiring itself
// works end to end.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../Chart.vue'
import { GRID_TYPES } from './gridTypes'
import { RuleGrid } from 'jui-graph-ts'

describe('gridTypes registration - "rule"', () => {
  it('GRID_TYPES registers RuleGrid under the "rule" key', () => {
    expect(GRID_TYPES.rule).toBe(RuleGrid)
  })

  it('mounts a <Chart> with a "rule" y-axis grid without throwing, and renders its axis line + ticks', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A'] },
            y: { type: 'rule', domain: 'v', step: 10 },
            data: [{ name: 'A', v: 5 }],
          },
        ],
      },
    })

    const svg = wrapper.element.querySelector('svg')
    expect(svg).not.toBeNull()
    // The rule grid draws its own reference axis line + tick marks directly via <line> elements
    // (see rule.ts's top()/bottom()/left()/right() - bypasses the usual grid pattern/base-line
    // mixin entirely), so at minimum some <line> element should have rendered without throwing.
    expect(svg!.querySelectorAll('line').length).toBeGreaterThan(0)
  })
})
