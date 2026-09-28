// Port of legacy `src/brush/scatterpath.js` ("chart.brush.scatterpath", extend:
// "chart.brush.core") - a high-performance scatter variant: instead of one SVG element per point
// (like `scatter.js`), it batches every point into 5 `PathSymbolElement`s (`util.svg.pathSymbol`,
// `jui-graph-ts`'s `element.path.symbol.ts`) via `util.base`'s "optimized loop" (`_.loop`, ROUND-
// ROBIN-assigns each point index to one of 5 groups) - one `<path>` `d` string per group instead of
// one DOM node per point.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushSeriesXY } from 'jui-graph-ts'

/** `chart.brush.scatterpath`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`) - a
 * high-performance `scatter`-like brush batched into 5 `<path>` elements instead of one node per
 * point (see this file's header comment). */
export interface ScatterPathBrushOptions {
  /** Marker shape for every point (unlike `scatter.ts`, this can't vary per point/callback). */
  symbol?: 'circle' | 'triangle' | 'rectangle' | 'cross'
  /** Marker width/height in px. */
  size?: number
  /** Marker stroke width in px. */
  strokeWidth?: number
}

/** Own `chart.brush.scatterpath.setup()` fields - see legacy `scatterpath.js`. */
export const SCATTERPATH_BRUSH_OWN_DEFAULTS: ScatterPathBrushOptions = {
  symbol: 'circle',
  size: 7,
  strokeWidth: 1,
}

/** Inlined `util.base`'s `loop(total)` ("최적화된 루프") - see `jui-graph-ts`'s own `brush/core.ts`
 * (its `getXY()` uses the identical inlined helper, non-exported there too) for the same 5-way
 * round-robin batching this brush's own real source needs. */
function loop(total: number): (callback: (index: number, group: number) => void) => void {
  const start = 0
  const end = total
  const unit = Math.ceil(total / 5)

  return function (callback: (index: number, group: number) => void) {
    let first = start
    let second = unit * 1
    let third = unit * 2
    let fourth = unit * 3
    let fifth = unit * 4
    const firstMax = second
    const secondMax = third
    const thirdMax = fourth
    const fourthMax = fifth
    const fifthMax = end

    while (first < firstMax && first < end) {
      callback(first, 1)
      first++

      if (second < secondMax && second < end) {
        callback(second, 2)
        second++
      }
      if (third < thirdMax && third < end) {
        callback(third, 3)
        third++
      }
      if (fourth < fourthMax && fourth < end) {
        callback(fourth, 4)
        fourth++
      }
      if (fifth < fifthMax && fifth < end) {
        callback(fifth, 5)
        fifth++
      }
    }
  }
}

export class ScatterPathBrush extends CoreBrush {
  /** Draws every target's points batched into exactly 5 `PathSymbolElement`s instead of one node
   * per point (see this file's header comment): builds a template of the configured `symbol`
   * shape at `size`x`size` via a throwaway `pathSymbol()` (`path`, removed again at the end - only
   * used to generate `tpl`), creates the 5 real symbol-path groups upfront, then round-robin
   * assigns every `(target, point-index)` pair to one of them via the inlined `loop()` helper,
   * appending each point's coordinates (floored via `| 0`) to its assigned group's path data.
   * Every point across every target shares one flat `color(0)` - unlike `ScatterBrush`, colors
   * don't vary per row/target here. */
  private drawScatter(points: BrushSeriesXY[]): any {
    const brush = this.brush as Record<string, unknown>
    const width = brush.size as number
    const height = width
    const color = this.color(0)
    const strokeWidth = brush.strokeWidth as number

    const opt = {
      fill: 'none',
      stroke: color,
      'stroke-width': strokeWidth,
      'stroke-opacity': 1,
      'stroke-linecap': 'butt',
      'stroke-linejoin': 'round',
    }

    const g = this.chart.svg.group()
    const path = this.chart.svg.pathSymbol()

    const tpl = path.template(width, height)

    const count = 5
    const list: any[] = []

    for (let i = 1; i <= count; i++) {
      list[i] = this.chart.svg.pathSymbol(opt)
    }

    const doLoop = loop(points[0].x.length)

    for (let i = 0; i < points.length; i++) {
      const symbol = brush.symbol as keyof typeof tpl

      doLoop((index, group) => {
        list[group].add(points[i].x[index] | 0, points[i].y[index] | 0, tpl[symbol])
      })
    }

    for (let i = 1; i <= count; i++) {
      g.append(list[i])
    }

    path.remove()

    return g
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Resolves every
   * target's `{x, y}` series via `getXY(false)` (`isCheckMinMax: false`, since this brush never
   * needs per-point min/max flags) and hands it to `drawScatter()`. */
  draw = (): any => {
    return this.drawScatter(this.getXY(false))
  }

  /** Returns this brush's own config defaults (`SCATTERPATH_BRUSH_OWN_DEFAULTS`) for
   * `builder.ts`'s `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return SCATTERPATH_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('scatterpath', ScatterPathBrush)
