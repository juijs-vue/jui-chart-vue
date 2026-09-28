// Port of legacy `src/brush/fullstackcylinder3d.js` ("chart.brush.fullstackcylinder3d", extend:
// "chart.brush.fullstackcolumn3d") - extends `FullStackColumn3DBrush` (confirmed from the legacy
// file's own `extend:` field), reusing its `drawBefore()`/`draw()`/`drawText()` wholesale and
// overriding `drawMain()` (same "shorten every non-first segment's height by its projected top
// sliver" cylinder-stacking trick `stackcylinder3d.ts` already uses) and `getTextXY()` (offsets
// the label to the cylinder's own visual center, factoring in the projected depth offset).
import { registerBrush } from 'jui-graph-ts'
import { FullStackColumn3DBrush } from './fullstackcolumn3d'
import type { FullStackColumn3DBrushOptions } from './fullstackcolumn3d'

/** `chart.brush.fullstackcylinder3d` has no `setup()` of its own - it inherits
 * `FullStackColumn3DBrush`'s options verbatim. Re-exported under this name purely so a generated
 * doc page for `"fullstackcylinder3d"` has something to point at. */
export type FullStackCylinder3DBrushOptions = FullStackColumn3DBrushOptions

export class FullStackCylinder3DBrush extends FullStackColumn3DBrush {
  drawMain(index: number, width: number, height: number, degree: unknown, depth: number): any {
    const top = Math.sin((this.axis.c as unknown as { radian: number }).radian) * depth
    const h = index > 0 ? height - top : height

    return this.chart.svg.cylinder3d(this.color(index), width, h, degree as number, depth)
  }

  getTextXY(index: number, x: number, y: number, depth: number): { x: number; y: number } {
    const radian = (this.axis.c as unknown as { radian: number }).radian
    const top = Math.sin(radian) * depth

    return {
      x: x + (Math.cos(radian) * depth) / 2,
      y: y - (index > 0 ? top : 0),
    }
  }
}

registerBrush('fullstackcylinder3d', FullStackCylinder3DBrush)
