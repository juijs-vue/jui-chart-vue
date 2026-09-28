// Port of legacy `src/brush/selectbox.js` ("chart.brush.selectbox", extend: "chart.brush.core") -
// extends `CoreBrush` directly. Only `static setup()` field is `clip: false`. Draws one invisible
// (opacity 0, hover-revealed) clickable overlay cell per tick interval on a DATE x-axis -
// `this.axis.x.ticks("milliseconds", this.axis.get("x").interval)` requires a real date/time scale
// (`util/scale.ts`'s `time()`, which `jui-graph-ts`'s real `DateGrid` already provides in full -
// unlike `main` branch's from-scratch Vue port, which never built a real date-axis subsystem and
// had to approximate this call site with hand-rolled millisecond-stepping math instead, per its
// own `useSelectBox.ts` header comment). Ported here as a literal, direct call against the real
// scale - no approximation needed.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

/** `chart.brush.selectbox`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface SelectBoxBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `selectbox.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.selectbox.setup()` fields - see legacy `selectbox.js`. */
export const SELECT_BOX_BRUSH_OWN_DEFAULTS: SelectBoxBrushOptions = {
  clip: false,
}

type DateAxisScale = BrushAxisScale & {
  ticks(type: 'milliseconds', interval: number): Date[]
}

export class SelectBoxBrush extends CoreBrush {
  private g: any
  private zeroY = 0
  private width = 0
  private height = 0
  private ticks: Date[] = []

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. Caches
   * the bottom plot-area edge (`zeroY`), each cell's width (the x-axis row band) and height (the
   * full plot area height), and the list of tick boundaries (`ticks`) from a real date/time scale
   * (see this file's header comment on why this requires the real `util/scale.ts` `time()` scale,
   * unlike `main` branch's approximated port). */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.zeroY = this.axis.area('y2')
    this.width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.height = this.axis.area('height')
    this.ticks = (this.axis.x as DateAxisScale).ticks('milliseconds', (this.axis.get('x') as Record<string, unknown>).interval as number)
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Draws one
   * invisible (`fill-opacity`/`stroke-opacity: 0`) full-height overlay rect per consecutive pair
   * of tick boundaries, revealed (background + border) only on hover, and wires `addEvent()` with
   * a `{start, end}` payload (the tick interval's own boundary dates) instead of the usual
   * row-index/target-key shape - `addEvent()`'s `object`-typed `dataIndex` branch is what makes
   * that possible (see `jui-graph-ts`'s `CoreBrush.addEvent()` doc comment). */
  draw = (): any => {
    const bgColor = this.chart.theme('selectBoxBackgroundColor')
    const bgOpacity = this.chart.theme('selectBoxBackgroundOpacity')
    const lineColor = this.chart.theme('selectBoxBorderColor')
    const lineOpacity = this.chart.theme('selectBoxBorderOpacity')

    for (let i = 0; i < this.ticks.length - 1; i++) {
      const startX = (this.axis.x as BrushAxisScale)(this.ticks[i])

      const r = this.svg
        .rect({
          width: this.width,
          height: this.height,
          fill: bgColor,
          'fill-opacity': 0,
          stroke: lineColor,
          'stroke-opacity': 0,
          cursor: 'pointer',
        })
        .translate(startX, this.zeroY - this.height)

      const elem = r
      elem.hover(
        () => {
          elem.attr({
            'fill-opacity': bgOpacity,
            'stroke-opacity': lineOpacity,
          })
        },
        () => {
          elem.attr({
            'fill-opacity': 0,
            'stroke-opacity': 0,
          })
        },
      )

      this.addEvent(r, {
        start: this.ticks[i],
        end: this.ticks[i + 1],
      })

      this.g.append(r)
    }

    return this.g
  }

  /** Returns this brush's own config defaults (`SELECT_BOX_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return SELECT_BOX_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('selectbox', SelectBoxBrush)
