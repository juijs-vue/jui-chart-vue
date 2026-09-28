// Port of legacy `src/brush/splitline.js` ("chart.brush.splitline", extend: "chart.brush.core") -
// a line brush that draws two visually-distinct segments split at a given `split` index/date: the
// portion before `split` in the normal per-target color, the portion from `split` onward
// re-styled with the theme's `lineSplitBorderColor`/`lineSplitBorderOpacity` (falling back to the
// normal color when that theme key is `null`, e.g. the `classic` theme's own default). Used
// directly by the real site's own "Line Sample" (`split_line.js`) demo, and as the base class
// `splitarea.ts` (`chart.brush.splitarea`) extends for its own "split area under a line" variant.
//
// **Source provenance**: no `src/brush/splitline.js` counterpart existed anywhere in this repo's
// copied legacy source tree (confirmed via `find src -iname "splitline*"` before this port) even
// though it's real, live code both in the real bundled site engine
// (`www.jui-vue.io/lib/jui/js/chart.js`, uncompressed, line ~13859) and used directly by a real
// site demo (`play/chart/json/split_line.js`). Sourced from `juijs/store.jui.io`'s own bundled
// asset mirror (`public/jui-all/jui-chart/js/brush/splitline.js`), cross-checked byte-identical
// against the real uncompressed `chart.js` bundle's own inline copy - copied verbatim into this
// repo's own `src/brush/splitline.js` before this port, per this project's normal workflow.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushSeriesXY } from 'jui-graph-ts'

/** `chart.brush.splitline`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface SplitLineBrushOptions {
  /** Line-drawing style, same as `LineBrush`'s own `symbol`. */
  symbol?: 'normal' | 'curve' | 'step'
  /** Index (or date, for a date axis) the line's style switches at - everything before uses the
   * normal per-target color, everything from here on uses the theme's split color; `null` draws
   * no split (single uniform style). */
  split?: number | Date | null
}

/** Own `chart.brush.splitline.setup()` fields - see legacy `splitline.js`. */
export const SPLITLINE_BRUSH_OWN_DEFAULTS: SplitLineBrushOptions = {
  symbol: 'normal',
  split: null,
}

export class SplitLineBrush extends CoreBrush {
  /**
   * @method createLine
   * Builds ONE `<g>` containing (up to) two `<path>`s for target index `index`: everything before
   * `brush.split` in the normal per-index color, everything from `split` onward re-styled with
   * `lineSplitBorderColor`/`lineSplitBorderOpacity` - a NEW `<path>` is only started once, the
   * first time the split boundary is crossed (`g.children.length == 0` guard), never again per
   * row after that.
   */
  createLine(pos: BrushSeriesXY, index: number): any {
    const opts: Record<string, unknown> = {
      stroke: this.color(index),
      'stroke-width': this.chart.theme('lineBorderWidth'),
      fill: 'transparent',
    }

    const split = (this.brush as Record<string, unknown>).split as number | Date | null
    const symbol = (this.brush as Record<string, unknown>).symbol as string

    const x = pos.x
    const y = pos.y
    let px: { p1: number[]; p2: number[] } | null = null
    let py: { p1: number[]; p2: number[] } | null = null

    const g = this.chart.svg.group()
    let p: any = this.chart.svg.path(opts).MoveTo(x[0], y[0])

    if (symbol == 'curve') {
      px = this.curvePoints(x)
      py = this.curvePoints(y)
    }

    for (let i = 0; i < x.length - 1; i++) {
      if (g.children.length == 0) {
        const xInverted =
          split instanceof Date
            ? ((this.axis.x as BrushAxisScale & { invert(v: number): unknown }).invert(x[i]) as Date)
            : null

        if ((typeof split === 'number' && Number.isInteger(split) && i == split) || (split instanceof Date && xInverted!.getTime() >= split.getTime())) {
          const color = this.chart.theme('lineSplitBorderColor')
          const opacity = this.chart.theme('lineSplitBorderOpacity')

          g.append(p)

          opts['stroke'] = color != null ? color : opts['stroke']
          opts['stroke-opacity'] = opacity

          p = this.chart.svg.path(opts).MoveTo(x[i], y[i])
        }
      }

      if (symbol == 'step') {
        const sx = x[i] + (x[i + 1] - x[i]) / 2

        p.LineTo(sx, y[i])
        p.LineTo(sx, y[i + 1])
      }

      if (symbol != 'curve') {
        p.LineTo(x[i + 1], y[i + 1])
      } else {
        p.CurveTo(px!.p1[i], py!.p1[i], px!.p2[i], py!.p2[i], x[i + 1], y[i + 1])
      }
    }

    g.append(p)

    return g
  }

  drawLine(path: BrushSeriesXY[]): any {
    const g = this.chart.svg.group()

    for (let k = 0; k < path.length; k++) {
      const p = this.createLine(path[k], k)

      this.addEvent(p, undefined, k)
      g.append(p)
    }

    return g
  }

  draw = (): any => {
    return this.drawLine(this.getXY())
  }

  static setup(): Record<string, unknown> {
    return SPLITLINE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('splitline', SplitLineBrush)
