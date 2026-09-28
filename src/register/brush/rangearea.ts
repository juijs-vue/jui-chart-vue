// Port of legacy `src/brush/rangearea.js` ("chart.brush.rangearea", extend: "chart.brush.core") -
// extends `CoreBrush` DIRECTLY (confirmed from the legacy file's own `extend:` field) - shares NO
// code with `AreaBrush`. Declares NO options of its own at all (no `static setup()` in the legacy
// source - cross-checked against `main` branch's `RangeAreaChart.vue` header comment, which
// independently confirmed the same "deliberately minimal, no symbol/startZero/line/opacity/
// display/active/activeEvent" finding from the same source file). Each row's target field is a
// `[low, high]` 2-element tuple (like `RangeBarBrush`/`RangeColumnBrush`) - `draw()` builds one
// closed polygon per target: `value[0]` (low) traced forward across every row, then `value[1]`
// (high) traced backward - a literal point-to-point band, no curve/step interpolation. Also
// confirmed (cross-checked against the same `main` branch component): `draw()` never calls
// `this.addEvent(...)` anywhere, unlike `rangebar.js`/`rangecolumn.js` - so no per-element event
// forwarding is added here either, matching the legacy source's own real gap, not an oversight.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData, BrushOptions } from 'jui-graph-ts'

/** `chart.brush.rangearea` declares no config fields of its own - see this file's own header
 * comment. Re-exported as an alias for `jui-graph-ts`'s base `BrushOptions` purely so a future
 * `jui-api-doc` page for `"rangearea"` has a named type to point at; each row's target field is
 * a `[low, high]` 2-element tuple. */
export type RangeAreaBrushOptions = BrushOptions

/**
 * `chart.brush.rangearea`: draws one closed band polygon per target, where each row's value is a
 * `[low, high]` tuple - traces the low bound forward across every row then the high bound
 * backward, with straight point-to-point edges (no curve/step interpolation). Declares no config
 * options and wires no per-element events at all, both genuine gaps in the legacy source, not
 * oversights of this port (see this file's own header comment).
 */
export class RangeAreaBrush extends CoreBrush {
  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Builds one
   * closed polygon per target field: traces `value[0]` (the low bound) forward across every row,
   * then `value[1]` (the high bound) backward across every row, producing a single band shape with
   * straight point-to-point edges (no curve/step interpolation, unlike `LineBrush`). Which axis is
   * treated as the "index" axis vs. the "value" axis is picked by `isRangeY`, same convention as
   * `CoreBrush.getXY()`. See this file's header comment for why no `addEvent()` call exists here. */
  draw = (): any => {
    const g = this.svg.group()
    const targets = this.brush.target ?? []
    const datas = this.axis.data as BrushData[]
    const isRangeY = (this.axis.y as BrushAxisScale).type == 'range'

    for (let i = 0; i < targets.length; i++) {
      const p = this.svg.polygon({
        fill: this.color(i),
        'fill-opacity': this.chart.theme('areaBackgroundOpacity'),
        'stroke-width': 0,
      })

      for (let j = 0; j < datas.length; j++) {
        const value = datas[j][targets[i]] as [unknown, unknown]

        if (isRangeY) {
          p.point((this.axis.x as BrushAxisScale)(j), (this.axis.y as BrushAxisScale)(value[0]))
        } else {
          p.point((this.axis.x as BrushAxisScale)(value[0]), (this.axis.y as BrushAxisScale)(j))
        }
      }

      for (let j = datas.length - 1; j >= 0; j--) {
        const value = datas[j][targets[i]] as [unknown, unknown]

        if (isRangeY) {
          p.point((this.axis.x as BrushAxisScale)(j), (this.axis.y as BrushAxisScale)(value[1]))
        } else {
          p.point((this.axis.x as BrushAxisScale)(value[1]), (this.axis.y as BrushAxisScale)(j))
        }
      }

      g.append(p)
    }

    return g
  }

  /** Returns an empty object - this brush declares no config fields of its own (see header
   * comment) and relies entirely on `builder.ts`'s `defineOptions()` chain walk for `CoreBrush`/
   * `Draw`'s own defaults. */
  static setup(): Record<string, unknown> {
    // No own options at all - see header comment. Relies entirely on the (now-fixed)
    // `defineOptions()` chain walk for `CoreBrush`/`Draw`'s own defaults.
    return {}
  }
}

registerBrush('rangearea', RangeAreaBrush)
