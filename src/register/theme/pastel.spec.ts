import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'
import { pastelTheme } from './pastel'

describe('pastel theme', () => {
  it('has all 318 keys extracted from the real site engine (lib/jui/js/chart.min.js\'s chart.theme.pastel), plus 35 restored shared defaults', () => {
    // The real extracted object had 318 keys - `pastel` genuinely has fewer keys than the other 4
    // themes in production (see this file's own header comment). 35 of those missing keys were
    // later restored (not fabricated): confirmed byte-identical across classic/dark/gradient/
    // pattern, i.e. real theme-agnostic shared defaults, not invented pastel-specific values - see
    // the inline comments at each restored block (`rateBar*`, `pieDisableBackgroundOpacity`,
    // `guideline*`, `bubbleCloud*`, `equalizerColumnError*`) and `register/theme/types.ts`'s own
    // header for the full investigation, including the 5 keys (`selectBox*` x4,
    // `crossBorderDashArray`) deliberately left un-restored because no single faithful value
    // exists for them.
    expect(Object.keys(pastelTheme).length).toBe(318 + 35)
  })

  it('a couple of representative values match the extraction byte-for-byte', () => {
    expect(pastelTheme.fontFamily).toBe('Caslon540BT-Regular,Times,New Roman,serif')
    expect(pastelTheme.backgroundColor).toBe('#fff')
    expect(pastelTheme.colors).toEqual([
      '#73e9d2', '#fef92c', '#ff9248', '#b7eef6', '#08c4e0', '#ffb9ce', '#ffd4ba', '#14be9d', '#ebebeb', '#666666', '#cdbfe3', '#bee982', '#c22269',
    ])
    expect(pastelTheme.barBorderColor).toBe('none')
    expect(pastelTheme.lineSplitBorderColor).toBeNull()
  })

  it('restored shared-default keys match the identical value every other theme sets', () => {
    // Cross-checked directly against classic.ts/dark.ts/gradient.ts/pattern.ts's own literal
    // values (byte-identical across all 4) - not invented for pastel specifically.
    expect(pastelTheme.pieDisableBackgroundOpacity).toBe(0.5)
    expect(pastelTheme.guidelineBorderColor).toBe('#a9a9a9')
    expect(pastelTheme.guidelineBorderDashArray).toBe('2,2')
    expect(pastelTheme.bubbleCloudFontWeight).toBe('bold')
    expect(pastelTheme.equalizerColumnErrorBackgroundColor).toBe('#ff0000')
    // rateBarFontColor/TooltipBackgroundColor/TooltipFontColor use the light-family (classic/
    // gradient/pattern) value, not dark.ts's own different dark-appropriate one.
    expect(pastelTheme.rateBarFontColor).toBe('#333')
    expect(pastelTheme.rateBarTooltipBackgroundColor).toBe('#fff')
    // Deliberately NOT restored - no single faithful value exists (see this file's own header
    // comment on `selectBox*`/`crossBorderDashArray`).
    expect(pastelTheme.selectBoxBackgroundColor).toBeUndefined()
    expect(pastelTheme.crossBorderDashArray).toBeUndefined()
  })

  it('registers under "pastel" - a <Chart theme="pastel"> mount reads it back via chart.theme(key)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        theme: 'pastel',
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', value1: 30 },
              { name: 'B', value1: 60 },
            ],
          },
        ],
        brush: [{ type: 'column', target: ['value1'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { theme(key: string): unknown } }).getBuilder()

    expect(builder.theme('fontFamily')).toBe('Caslon540BT-Regular,Times,New Roman,serif')
    expect(builder.theme('barBorderColor')).toBe('none')

    // `column` (`register/brush/column.ts`) reads `chart.theme('barBorderColor')` for its
    // rendered `<path>`'s `stroke` - same cross-check `column.spec.ts` already does for the
    // `classic` theme, here proving `pastel`'s own value flows through the real render pipeline.
    const path = wrapper.element.querySelector('g.brush-column path')!
    expect(path.getAttribute('stroke')).toBe('none')
  })
})
