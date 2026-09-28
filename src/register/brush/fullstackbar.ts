// Port of legacy `src/brush/fullstackbar.js` ("chart.brush.fullstackbar", extend:
// "chart.brush.stackbar") - extends `StackBarBrush` (confirmed from the legacy file's own
// `extend:` field), reusing `getBarElement`/`setActiveEffect`/`setActiveEffectOption`/
// `setActiveEvent`/`setActiveEventOption`/`addBarElement` unchanged; overrides `drawBefore`/
// `draw` and adds its own `drawText()` (a new method, reused unchanged by `FullStackColumnBrush`).
// "Full stack" = 100%-normalized: each row's bar always fills the whole axis width, segment widths
// are `target[j]`'s share of that row's OWN sum (`axis.x.rate(list[j], sum)`), not raw values.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { StackBarBrush } from './stackbar'
import type { StackBarBrushOptions } from './stackbar'

/** `chart.brush.fullstackbar`'s own config fields (`edge` is inherited from `StackBarBrush`
 * unchanged; `outerPadding` is redeclared with a different default here). "Full stack" = each
 * row's bar always fills the whole axis width, with segment widths as each target's share of
 * that row's own sum (not raw values) - see this file's header comment. */
export interface FullStackBarBrushOptions extends StackBarBrushOptions {
  /** Padding reserved at the top/bottom of each row's 100%-stacked bar. */
  outerPadding?: number
  /** Shows each segment's percentage-of-row label centered on that segment. */
  showText?: boolean
}

/** Own `chart.brush.fullstackbar.setup()` fields - see legacy `fullstackbar.js`. */
export const FULL_STACK_BAR_BRUSH_OWN_DEFAULTS: FullStackBarBrushOptions = {
  outerPadding: 15,
  showText: false,
}

export class FullStackBarBrush extends StackBarBrush {
  private fsBarHeight = 0

  /** Overrides `StackBarBrush.drawBefore()`: caches the shared row lane height via the inherited
   * `getTargetSize()`. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.fsBarHeight = this.getTargetSize()
  }

  /** Builds one segment's percentage label centered at `(x, y)`, or returns `null` when `percent`
   * is `0`/`NaN` (nothing worth labeling). `brush.showText` as a function overrides the label text
   * entirely (called with `percent`); otherwise the label is `"<percent>%"`. New in
   * `FullStackBarBrush`, reused unchanged by `FullStackColumnBrush`. */
  drawText(percent: number, x: number, y: number): any {
    if (percent === 0 || isNaN(percent)) return null

    const showText = (this.brush as Record<string, unknown>).showText
    const result = typeof showText === 'function' ? (showText as (this: unknown, percent: number) => unknown).call(this, percent) : percent + '%'

    return this.chart.text(
      {
        'font-size': this.chart.theme('barFontSize'),
        fill: this.chart.theme('barFontColor'),
        x,
        y,
        'text-anchor': 'middle',
      },
      result as string,
    )
  }

  /** Overrides `StackBarBrush.draw()` for 100%-normalized stacking: each row's segment widths come
   * from `axis.x.rate(list[j], sum)` - the target's share of THAT ROW's own value sum, not a share
   * of the axis's global max - so every row's bar always fills the full axis width regardless of
   * its raw totals (see this file's header comment). A segment whose computed `width` is `NaN`
   * (e.g. `sum === 0`) is skipped entirely (not drawn, no label, but `startX` doesn't advance for
   * it either). When `brush.showText` isn't `false`, each segment gets a label of
   * `round(list[j] / sum * axis.x.max())` (via `drawText()`, formatted as `"<value>%"` by
   * default - genuinely a percentage only when the x-axis's configured max is `100`, which a
   * full-stack chart's own axis config normally sets up). Each segment group is wired up via the
   * inherited
   * `setActiveEventOption()`/`addBarElement()`/`setActiveEffectOption()` for the shared active-bar
   * highlighting `StackBarBrush` provides. */
  draw = (): any => {
    const target = this.brush.target ?? []

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const group = this.chart.svg.group()

      const startY = this.offset('y', index) - this.fsBarHeight / 2
      let sum = 0
      const list: number[] = []

      for (let j = 0; j < target.length; j++) {
        const width = row[target[j]] as number
        sum += width
        list.push(width)
      }

      let startX = 0
      const max = (this.axis.x as BrushAxisScale & { max(): number }).max()

      for (let j = 0; j < list.length; j++) {
        const width = (this.axis.x as BrushAxisScale & { rate(value: number, max: number): number }).rate(list[j], sum)
        const r = this.getBarElement(index, j)

        if (isNaN(width)) continue

        r.attr({
          x: startX,
          y: startY,
          width,
          height: this.fsBarHeight,
        })

        group.append(r)

        if ((this.brush as Record<string, unknown>).showText !== false) {
          const p = Math.round((list[j] / sum) * max)
          const x = startX + width / 2
          const y = startY + this.fsBarHeight / 2 + 5
          const text = this.drawText(p, x, y)

          if (text != null) group.append(text)
        }

        this.setActiveEventOption(group)

        startX += width
      }

      this.addBarElement(group)
      this.g.append(group)
    })

    this.setActiveEffectOption()

    return this.g
  }

  /** Returns this brush's own default options (`outerPadding`/`showText`), merged by
   * `defineOptions()` on top of the inherited `StackBarBrush`/`CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return FULL_STACK_BAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('fullstackbar', FullStackBarBrush)
