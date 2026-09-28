// Port of legacy `src/brush/stackline.js` ("chart.brush.stackline", extend: "chart.brush.line") -
// extends `LineBrush` (confirmed from the legacy file's own `extend:` field). The ENTIRE legacy
// file is just one override: `draw()` calls `this.drawLine(this.getStackXY())` instead of
// `this.drawLine(this.getXY())` - everything else (`drawBefore`, `createLine`, tooltips, active
// effects, `static setup()`) is reused unchanged from `LineBrush`.
import { registerBrush } from 'jui-graph-ts'
import { LineBrush } from './line'
import type { LineBrushOptions } from './line'

/** `chart.brush.stackline` has no `setup()` of its own - it inherits `LineBrush`'s options
 * verbatim (only `draw()` is overridden, to stack values via `getStackXY()`). Re-exported under
 * this name purely so a generated doc page for `"stackline"` has something to point at. */
export type StackLineBrushOptions = LineBrushOptions

export class StackLineBrush extends LineBrush {
  draw = (): any => {
    return this.drawLine(this.getStackXY())
  }
}

registerBrush('stackline', StackLineBrush)
