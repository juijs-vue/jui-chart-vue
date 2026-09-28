// Port of legacy `src/brush/stackcylinder3d.js` ("chart.brush.stackcylinder3d", extend:
// "chart.brush.stackcolumn3d") - extends `StackColumn3DBrush` (confirmed from the legacy file's
// own `extend:` field), reusing its `drawBefore()`/`draw()` wholesale and overriding ONLY
// `drawMain()`: every stacked segment EXCEPT the first (`index > 0`) has its height shortened by
// the projected "top" sliver (`sin(radian)*depth`) before building its cylinder, so consecutive
// cylinders visually butt up against each other without a projection-induced gap/overlap.
import { registerBrush } from 'jui-graph-ts'
import { StackColumn3DBrush } from './stackcolumn3d'
import type { StackColumn3DBrushOptions } from './stackcolumn3d'

/** `chart.brush.stackcylinder3d` has no `setup()` of its own - it inherits
 * `StackColumn3DBrush`'s options verbatim. Re-exported under this name purely so a generated doc
 * page for `"stackcylinder3d"` has something to point at. */
export type StackCylinder3DBrushOptions = StackColumn3DBrushOptions

/**
 * `chart.brush.stackcylinder3d`: extends `StackColumn3DBrush`, reusing its `drawBefore()`/
 * `draw()` wholesale and overriding only `drawMain()` to draw a cylinder instead of a box - every
 * segment except the first has its height shortened by its own projected "top" sliver first, so
 * consecutive cylinders visually butt up against each other without a projection gap/overlap.
 */
export class StackCylinder3DBrush extends StackColumn3DBrush {
  /** Overrides `StackColumn3DBrush.drawMain` to draw a cylinder instead of a box, shortening every
   * segment's height EXCEPT the first (`index > 0`) by its own projected "top" sliver
   * (`sin(radian) * depth`) first, so consecutive cylinders visually butt up against each other
   * without a projection-induced gap. `drawBefore`/`draw` are reused unchanged from the parent
   * class (see header comment). */
  drawMain(index: number, width: number, height: number, degree: unknown, depth: number): any {
    const top = Math.sin((this.axis.c as unknown as { radian: number }).radian) * depth
    const h = index > 0 ? height - top : height

    return this.chart.svg.cylinder3d(this.color(index), width, h, degree as number, depth)
  }
}

registerBrush('stackcylinder3d', StackCylinder3DBrush)
