// Port of legacy `src/brush/clustercylinder3d.js` ("chart.brush.clustercylinder3d", extend:
// "chart.brush.clustercolumn3d") - extends `ClusterColumn3DBrush` (confirmed from the legacy
// file's own `extend:` field, despite its stale "@extends chart.brush.bar" JSDoc comment),
// reusing its `drawBefore()`/`draw()` wholesale and overriding ONLY `drawMain()` to build a
// `cylinder3d(...)` instead of a `rect3d(...)` box - same shape as `cylinder3d.ts`'s own override
// of `column3d.ts`.
import { registerBrush } from 'jui-graph-ts'
import { ClusterColumn3DBrush } from './clustercolumn3d'
import type { ClusterColumn3DBrushOptions } from './clustercolumn3d'

/** `chart.brush.clustercylinder3d`'s own config fields - `topRate` is NEW over the inherited
 * `ClusterColumn3DBrush`'s `outerPadding`/`innerPadding`. */
export interface ClusterCylinder3DBrushOptions extends ClusterColumn3DBrushOptions {
  /** Ratio of the cylinder's top ellipse radius to its base radius (`1` = a true cylinder). */
  topRate?: number
}

/** Own `chart.brush.clustercylinder3d.setup()` fields - see legacy `clustercylinder3d.js`. */
export const CLUSTERCYLINDER3D_BRUSH_OWN_DEFAULTS: ClusterCylinder3DBrushOptions = {
  topRate: 1,
  outerPadding: 5,
  innerPadding: 5,
}

/** `chart.brush.clustercylinder3d`: identical clustered-lane layout to `ClusterColumn3DBrush`, but
 * each lane is drawn as a `chart.svg.cylinder3d()` (tapered per `brush.topRate`) instead of a plain
 * extruded box - achieved by overriding only `ClusterColumn3DBrush.drawMain()` and reusing its
 * `drawBefore()`/`draw()` wholesale. */
export class ClusterCylinder3DBrush extends ClusterColumn3DBrush {
  /** Overrides `ClusterColumn3DBrush.drawMain()`'s box shape with a `chart.svg.cylinder3d()`, using
   * `brush.topRate` for the top ellipse's radius ratio; all other layout/event logic in the
   * inherited `draw()` is unchanged. */
  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.cylinder3d(color, width, height, degree as number, depth, (this.brush as Record<string, unknown>).topRate as number)
  }

  /** Returns this brush's own default options (`topRate`/`outerPadding`/`innerPadding`), merged by
   * `defineOptions()` on top of the inherited `ClusterColumn3DBrush`/`CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return CLUSTERCYLINDER3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('clustercylinder3d', ClusterCylinder3DBrush)
