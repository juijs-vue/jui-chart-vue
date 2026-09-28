// Port of legacy `src/brush/path.js` ("chart.brush.path", extend: "chart.brush.core") - a general
// purpose closed-path brush: one `<path>` per target, moved through every data row's `axis.c(i,
// value)` position (the same panel-grid `{x,y}` projection `fullgauge.ts`/`bargauge.ts` already
// use for `axis.c(i)`, here called with a second `value` argument too - used directly by the real
// site's radar/circle-radar demos, via a `radar`-type `c` grid).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData, BrushOptions } from 'jui-graph-ts'

/** `chart.brush.path` declares no `static setup()`/config fields of its own - it relies entirely
 * on the inherited `CoreBrush`/`Draw` defaults. Re-exported as an alias for `jui-graph-ts`'s base
 * `BrushOptions` purely so a future `jui-api-doc` page for `"path"` has a named type to point at. */
export type PathBrushOptions = BrushOptions

type CAxis = (i: number, value: unknown) => { x: number; y: number }

export class PathBrush extends CoreBrush {
  draw = (): any => {
    const g = this.svg.group()
    const target = (this.brush.target ?? []) as string[]

    for (let ti = 0, len = target.length; ti < len; ti++) {
      const color = this.color(ti)

      const path = this.svg.path({
        fill: color,
        'fill-opacity': this.chart.theme('pathBackgroundOpacity'),
        stroke: color,
        'stroke-width': this.chart.theme('pathBorderWidth'),
      })

      g.append(path)

      this.eachData((data, i) => {
        const row = data as BrushData
        const index = i as number
        const obj = (this.axis.c as unknown as CAxis)(index, row[target[ti]])
        const x = obj.x - this.chart.area('x') + this.axis.padding('left')
        const y = obj.y - this.chart.area('y') + this.axis.padding('top')

        if (index == 0) {
          path.MoveTo(x, y)
        } else {
          path.LineTo(x, y)
        }
      })

      path.ClosePath()
    }

    return g
  }
}

registerBrush('path', PathBrush)
