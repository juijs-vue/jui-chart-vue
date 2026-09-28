// Port of legacy `src/brush/splitarea.js` ("chart.brush.splitarea", extend:
// "chart.brush.splitline") - extends `SplitLineBrush` (`splitline.ts`, confirmed from the legacy
// file's own `extend:` field), reusing its `createLine()`/`getXY()` wholesale via real TS class
// inheritance, only adding its own `drawArea()`/`draw()` (fills the area under each split line,
// itself split into two differently-colored regions at the same `brush.split` boundary
// `createLine()` already uses for its own stroke split). Used directly by the real site's own
// "Today's TPS" (`realtime1.js`) demo.
//
// **Source provenance**: same gap as `splitline.ts` - no `src/brush/splitarea.js` counterpart
// existed anywhere in this repo's copied legacy source tree (confirmed via `find src -iname
// "splitarea*"` before this port), despite being real, live code in the real bundled site engine
// (`www.jui-vue.io/lib/jui/js/chart.js`, uncompressed, line ~13952) and used directly by the real
// site's `realtime1.js` demo (confirmed rendering correctly on chartplay.jui.io, i.e. a genuine
// porting gap, not dead code). Sourced from `juijs/store.jui.io`'s own bundled asset mirror
// (`public/jui-all/jui-chart/js/brush/splitarea.js`), cross-checked byte-identical against the
// real uncompressed `chart.js` bundle's own inline copy - copied verbatim into this repo's own
// `src/brush/splitarea.js` before this port, per this project's normal workflow.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushSeriesXY } from 'jui-graph-ts'
import { SplitLineBrush } from './splitline'
import type { SplitLineBrushOptions } from './splitline'

/** `chart.brush.splitarea`'s own config fields. Note `line` is a NEW key over
 * `SplitLineBrush.setup()`'s own `symbol`/`split` (which this class still inherits unchanged, per
 * the real `extend` chain - `jui-graph-ts`'s `defineOptions()` walks the full chain itself, same
 * as every other multi-level brush this project has ported). */
export interface SplitAreaBrushOptions extends SplitLineBrushOptions {
  /** Draws the split line's own stroke on top of the filled area; `false` renders the fill only. */
  line?: boolean
}

/** Own `chart.brush.splitarea.setup()` fields - see legacy `splitarea.js`. Note `line` is a NEW
 * key over `SplitLineBrush.setup()`'s own `symbol`/`split` (which this class still inherits
 * unchanged, per the real `extend` chain - `jui-graph-ts`'s `defineOptions()` walks the full
 * chain itself, same as every other multi-level brush this project has ported). */
export const SPLITAREA_BRUSH_OWN_DEFAULTS: SplitAreaBrushOptions = {
  symbol: 'normal',
  split: null,
  line: true,
}

/**
 * `chart.brush.splitarea`: extends `SplitLineBrush`, reusing its `createLine()`/`getXY()`
 * wholesale and adding its own `drawArea()`/`draw()` to fill the area under each split line -
 * itself split into two differently-colored regions at the same `split` boundary the inherited
 * line stroke already uses. Used directly by the real site's "Today's TPS" realtime demo.
 */
export class SplitAreaBrush extends SplitLineBrush {
  /** For each target, builds the inherited `createLine()` path(s) and extends each one into a
   * closed fill shape by dropping straight down to `maxY` (the plot area's bottom) and back:
   * everything up to the `split` boundary (resolved to a row index once per target, ahead of the
   * fill loop, when `split` is a `Date`) fills with the normal series color, everything from
   * `split` onward fills with `areaSplitBackgroundColor` - mirroring `createLine()`'s own two-tone
   * stroke split, but as two differently-colored fill regions instead. When `split` is `null`, the
   * ENTIRE line is treated as "before the split" (filled with the normal color only - `split`
   * defaults to `xList.length - 1`, the last index, so the second/`splitColor` region is empty).
   * Draws the fill first (`g.prepend`, so it sits visually beneath), then - when `line` is set -
   * prepends the split line's own stroke on top via a second `createLine()` call. */
  drawArea(path: BrushSeriesXY[]): any {
    const g = this.chart.svg.group()
    const maxY = this.chart.area('height')
    let split = (this.brush as Record<string, unknown>).split as number | Date | null
    const splitColor = this.chart.theme('areaSplitBackgroundColor')

    for (let k = 0; k < path.length; k++) {
      const opts: Record<string, unknown> = {
        fill: this.color(k),
        'fill-opacity': this.chart.theme('areaBackgroundOpacity'),
        'stroke-width': 0,
      }

      const line = this.createLine(path[k], k)
      const xList = path[k].x

      // 날짜일 경우, 해당 인덱스를 구해야 함 (a Date `split` is resolved to its row INDEX here,
      // once per target, before the per-segment fill loop below - unlike `createLine()`'s own
      // `split` check, which re-derives the inverted x-value per row instead of caching an index).
      if (split instanceof Date) {
        for (let i = 0; i < xList.length - 1; i++) {
          if (((this.axis.x as BrushAxisScale & { invert(v: number): unknown }).invert(xList[i]) as Date).getTime() >= split.getTime()) {
            split = i
            break
          }
        }
      }

      line.each((i: number, p: any) => {
        if (i == 0) {
          split = split != null ? split : xList.length - 1

          p.LineTo(xList[split as number], maxY)
          p.LineTo(xList[0], maxY)
          p.attr(opts)
        } else {
          opts['fill'] = splitColor

          p.LineTo(xList[xList.length - 1], maxY)
          p.LineTo(xList[split as number], maxY)
          p.attr(opts)
        }

        p.ClosePath()
      })

      this.addEvent(line, undefined, k)
      g.prepend(line)

      // Add line
      if ((this.brush as Record<string, unknown>).line) {
        g.prepend(this.createLine(path[k], k))
      }
    }

    return g
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Resolves every
   * target's `{x, y}` series via the inherited `CoreBrush.getXY()` and hands it to `drawArea()`. */
  draw = (): any => {
    return this.drawArea(this.getXY())
  }

  /** Returns this brush's own config defaults (`SPLITAREA_BRUSH_OWN_DEFAULTS`) for `builder.ts`'s
   * `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return SPLITAREA_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('splitarea', SplitAreaBrush)
