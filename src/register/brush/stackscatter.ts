// Port of legacy `src/brush/stackscatter.js` ("chart.brush.stackscatter", extend:
// "chart.brush.scatter") - extends `ScatterBrush` (confirmed from the legacy file's own `extend:`
// field). Same single-override shape as `StackLineBrush`/`StackAreaBrush`: `draw()` calls
// `this.drawScatter(this.getStackXY())` instead of `this.drawScatter(this.getXY())`.
import { registerBrush } from 'jui-graph-ts'
import { ScatterBrush } from './scatter'
import type { ScatterBrushOptions } from './scatter'

/** `chart.brush.stackscatter` has no `setup()` of its own - it inherits `ScatterBrush`'s options
 * verbatim (only `draw()` is overridden, to stack values via `getStackXY()`). Re-exported under
 * this name purely so a generated doc page for `"stackscatter"` has something to point at. */
export type StackScatterBrushOptions = ScatterBrushOptions

export class StackScatterBrush extends ScatterBrush {
  draw = (): any => {
    return this.drawScatter(this.getStackXY())
  }
}

registerBrush('stackscatter', StackScatterBrush)
