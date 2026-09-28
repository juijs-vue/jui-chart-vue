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

/**
 * `chart.brush.stackline`: extends `LineBrush` with exactly one override - `draw()` stacks values
 * via the inherited `getStackXY()` instead of `getXY()` before handing off to `drawLine()`, which
 * is otherwise reused unchanged along with `drawBefore`/tooltips/active effects.
 */
export class StackLineBrush extends LineBrush {
  /** Arrow-function class field overriding `LineBrush.draw` - the only override this class makes
   * (see header comment): draws stacked series via the inherited `CoreBrush.getStackXY()` instead
   * of `getXY()`, reusing `LineBrush.drawLine()` unchanged. */
  draw = (): any => {
    return this.drawLine(this.getStackXY())
  }
}

registerBrush('stackline', StackLineBrush)
