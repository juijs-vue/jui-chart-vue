// Port of legacy `src/brush/stackarea.js` ("chart.brush.stackarea", extend: "chart.brush.area") -
// extends `AreaBrush` (confirmed from the legacy file's own `extend:` field). Same single-override
// shape as `StackLineBrush`: `draw()` calls `this.drawArea(this.getStackXY())` instead of
// `this.drawArea(this.getXY())` - everything else reused unchanged from `AreaBrush`.
import { registerBrush } from 'jui-graph-ts'
import { AreaBrush } from './area'
import type { AreaBrushOptions } from './area'

/** `chart.brush.stackarea` has no `setup()` of its own - it inherits `AreaBrush`'s options
 * verbatim (only `draw()` is overridden, to stack values via `getStackXY()`). Re-exported under
 * this name purely so a generated doc page for `"stackarea"` has something to point at. */
export type StackAreaBrushOptions = AreaBrushOptions

/**
 * `chart.brush.stackarea`: extends `AreaBrush` with exactly one override - `draw()` stacks values
 * via the inherited `getStackXY()` instead of `getXY()` before handing off to `drawArea()`, which
 * is otherwise reused unchanged.
 */
export class StackAreaBrush extends AreaBrush {
  /** Arrow-function class field overriding `AreaBrush.draw` - the only override this class makes
   * (see header comment): draws stacked series via the inherited `CoreBrush.getStackXY()` instead
   * of `getXY()`, reusing `AreaBrush.drawArea()` unchanged. */
  draw = (): any => {
    return this.drawArea(this.getStackXY())
  }
}

registerBrush('stackarea', StackAreaBrush)
