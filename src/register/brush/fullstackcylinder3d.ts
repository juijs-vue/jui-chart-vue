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

/** `chart.brush.fullstackcylinder3d`: identical 100%-normalized vertical stacking layout to
 * `FullStackColumn3DBrush`, but each segment is drawn as a `chart.svg.cylinder3d()` instead of a
 * plain extruded box - achieved by overriding only `drawMain()` (shortening every non-first
 * segment's height by its projected top sliver so stacked cylinders don't visually overlap at their
 * seams, the same trick `StackCylinder3DBrush` uses) and `getTextXY()` (re-centering each segment's
 * percentage label on the cylinder's own isometric footprint), reusing
 * `drawBefore()`/`draw()`/`drawText()` wholesale. */
export class FullStackCylinder3DBrush extends FullStackColumn3DBrush {
  /** Overrides `FullStackColumn3DBrush.drawMain()`'s box shape with a `chart.svg.cylinder3d()`.
   * Every segment except the first (`index > 0`) has its height shortened by the isometric depth's
   * vertical sliver (`sin(radian) * depth`) - the same "shorten every non-first segment's height by
   * its projected top sliver" trick `stackcylinder3d.ts` uses, so stacked cylinders don't visually
   * overlap at their seams the way stacked boxes would. */
  drawMain(index: number, width: number, height: number, degree: unknown, depth: number): any {
    const top = Math.sin((this.axis.c as unknown as { radian: number }).radian) * depth
    const h = index > 0 ? height - top : height

    return this.chart.svg.cylinder3d(this.color(index), width, h, degree as number, depth)
  }

  /** Overrides `FullStackColumn3DBrush.getTextXY()` to offset a segment's percentage label to the
   * cylinder's own visual center: shifted right by half the depth's horizontal projection
   * (`cos(radian) * depth / 2`, centering it within the cylinder's isometric width), and, for every
   * segment except the first, shifted up by the same vertical sliver `drawMain()` shortens that
   * segment's height by. */
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
