// Port of legacy `src/brush/cylinder3d.js` ("chart.brush.cylinder3d", extend:
// "chart.brush.column3d") - extends `Column3DBrush` (confirmed from the legacy file's own
// `extend:` field), reusing its `drawBefore()`/`draw()` wholesale and overriding ONLY
// `drawMain()` to build a `chart.svg.cylinder3d(...)` (`jui-graph-ts`'s `SVG3d.cylinder3d()`)
// instead of a `rect3d(...)` box.
import { registerBrush } from 'jui-graph-ts'
import { Column3DBrush } from './column3d'
import type { Column3DBrushOptions } from './column3d'

/** `chart.brush.cylinder3d`'s own config fields - `topRate` is NEW over the inherited
 * `Column3DBrush`'s `outerPadding`/`innerPadding` (still inherited unchanged, per the real
 * `extend` chain). */
export interface Cylinder3DBrushOptions extends Column3DBrushOptions {
  /** Ratio of the cylinder's top ellipse radius to its base radius (`1` = a true cylinder;
   * `< 1` tapers toward the top like a frustum, `0` comes to a point). */
  topRate?: number
}

/** Own `chart.brush.cylinder3d.setup()` fields - see legacy `cylinder3d.js`. `topRate` is NEW
 * over the inherited `Column3DBrush.setup()`'s own `outerPadding`/`innerPadding` (still inherited
 * unchanged, per the real `extend` chain). */
export const CYLINDER3D_BRUSH_OWN_DEFAULTS: Cylinder3DBrushOptions = {
  topRate: 1,
  outerPadding: 10,
  innerPadding: 5,
}

export class Cylinder3DBrush extends Column3DBrush {
  /** Overrides `Column3DBrush.drawMain()`'s box shape with a `chart.svg.cylinder3d()`, using
   * `brush.topRate` for the top ellipse's radius ratio; all other layout/event logic in the
   * inherited `draw()` is unchanged. */
  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.cylinder3d(color, width, height, degree as number, depth, (this.brush as Record<string, unknown>).topRate as number)
  }

  /** Returns this brush's own default options (`topRate`/`outerPadding`/`innerPadding`), merged by
   * `defineOptions()` on top of the inherited `Column3DBrush`/`CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return CYLINDER3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('cylinder3d', Cylinder3DBrush)
