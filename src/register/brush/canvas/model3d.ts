// Port of legacy `src/brush/canvas/model3d.js` ("chart.brush.canvas.model3d", extend:
// "chart.brush.canvas.core") - draws a static 3D wireframe model (`brush.model`, a named lookup)
// by projecting its own local-space `sources` through the axis's `x`/`y`/`z` scales into
// `vertices`, then stroking each of its `faces` (index polygons into those vertices) as a closed
// path, once per animation frame (`this.addPolygon(data, callback)`, queued/z-sorted/drained by
// the inherited `CanvasCoreBrush`).
//
// **`jui.include("chart.polygon." + this.brush.model)` has no equivalent in this project's new
// architecture** - the real original resolves named 3D models through the OLD global
// `jui.define`/`jui.include` registry (the SAME registry whose absence is the whole reason
// `element.ts`'s `.is()`/`math.ts`'s `nice(..., true)` are documented, deliberately preserved
// `ReferenceError`s elsewhere in this project). Rather than reproduce that crash here too (which
// would leave `canvas.model3d` permanently unusable, unlike those two narrowly-scoped bugs), this
// ports the SAME real capability through a small LOCAL registry instead -
// `registerPolygonModel()`/`getPolygonModel()` below - entirely within this project's own
// authority (no `jui-graph-ts` changes). The real site's own `model3d_f16.js` demo's one real
// model, `chart.polygon.f16` (`play/chart/resource/f16_model.js`, loaded as a separate `<script>`
// by the real site, NOT part of the `jui-chart`/`juijs-graph` npm packages at all), is ported to
// `models/f16.ts` and registered here under `"f16"`.
import { registerBrush, CanvasCoreBrush, PolygonCore } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { F16Model } from './models/f16'

/** A `canvas.model3d`-compatible model: `sources` (raw local-space homogeneous vertices,
 * `[x,y,z,1]`), `faces` (index-triples/-polygons into the PROJECTED `vertices` array, built by
 * `drawBefore()` below from `sources`), both fixed at construction - `vertices` starts `[]` (per
 * `PolygonCore`'s own un-initialized field) and is filled in by this brush, not the model itself. */
export interface PolygonModel extends PolygonCore {
  sources: Float32Array[]
  faces: Float32Array[]
}

const modelRegistry = new Map<string, new () => PolygonModel>()

/** Registers a named 3D model constructor for `canvas.model3d`'s own `brush.model` lookup - this
 * project's own local stand-in for the real engine's `jui.define("chart.polygon.<name>", ...)`. */
export function registerPolygonModel(name: string, ctor: new () => PolygonModel): void {
  modelRegistry.set(name, ctor)
}

/** Looks up a model registered via `registerPolygonModel()` - `undefined` for an unknown name,
 * matching the original's own `jui.include(...)` returning `null`/`undefined` for that case
 * (`drawBefore()`'s own `if (Model3D != null)` guard, ported unchanged below). */
export function getPolygonModel(name: string): (new () => PolygonModel) | undefined {
  return modelRegistry.get(name)
}

registerPolygonModel('f16', F16Model as unknown as new () => PolygonModel)

/** `chart.brush.canvas.model3d`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface CanvasModel3DBrushOptions {
  /** Name of a model registered via `registerPolygonModel()` (e.g. `'f16'`); nothing is drawn
   * when the name isn't registered or is `null`. */
  model?: string | null
}

/** Own `chart.brush.canvas.model3d.setup()` fields - see legacy `canvas/model3d.js`. */
export const CANVAS_MODEL3D_BRUSH_OWN_DEFAULTS: CanvasModel3DBrushOptions = {
  model: null,
}

export class CanvasModel3DBrush extends CanvasCoreBrush {
  private model: PolygonModel | null = null

  /** Resolves `brush.model` through `getPolygonModel()`; when it names a registered model,
   * instantiates it and projects every one of its local-space `sources` through the 3D axis scales
   * into pixel-space `vertices` (stored back onto the model instance itself, `faces` untouched
   * since they're plain vertex-index lists), caching the fully-projected model on `this.model` for
   * `draw()`. When the name is unregistered (or `null`), `this.model` is left as whatever it was
   * before (`null` on a fresh brush), so `draw()` skips rendering entirely. */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const Model3D = getPolygonModel(brush.model as string)

    if (Model3D != null) {
      const model = new Model3D()

      for (let i = 0, len = model.sources.length; i < len; i++) {
        const x = (this.axis.x as BrushAxisScale)(model.sources[i][0])
        const y = (this.axis.y as BrushAxisScale)(model.sources[i][1])
        const z = (this.axis.z as BrushAxisScale)(model.sources[i][2])

        model.vertices[i] = new Float32Array([x, y, z, 1])
      }

      this.model = model
    }
  }

  /** Strokes the wireframe of the model resolved by `drawBefore()` (no-op when none was resolved).
   * Queues the whole model as a single `addPolygon()` entry so the engine's own z-sort/perspective
   * pass runs on it; the callback flattens every projected vertex down to its 2D `(x, y)` (dropping
   * `z`/`w`) into `cache`, then walks each face's vertex-index list building one closed subpath per
   * face - `moveTo` the first vertex, `lineTo` each middle vertex, and on the last vertex `lineTo`
   * back to the face's own first vertex (explicitly closing the loop, rather than relying on
   * `closePath()` to do it) - silently skipping any index that has no corresponding cached vertex.
   * All faces accumulate into one shared path (`beginPath()` runs once before `addPolygon()`, and
   * `stroke()`/`closePath()` once inside the callback after every face is added), stroked in a
   * single `color(0)` at a fixed `0.5`px line width. */
  draw = (): void => {
    if (this.model == null) return

    const canvas = this.canvas as CanvasRenderingContext2D
    canvas.lineWidth = 0.5
    canvas.strokeStyle = this.color(0)
    canvas.beginPath()

    this.addPolygon(this.model, (p) => {
      const cache: Float32Array[] = []
      const vertices = p.vertices
      const faces = p.faces

      for (let i = 0, len = vertices.length; i < len; i++) {
        const v = vertices[i]
        cache.push(new Float32Array([v[0], v[1]]))
      }

      for (let i = 0, len = faces.length; i < len; i++) {
        const f = faces[i]

        for (let j = 0, len2 = f.length; j < len2; j++) {
          const targetPoint = cache[f[j]]

          if (targetPoint) {
            const x = targetPoint[0]
            const y = targetPoint[1]

            if (j == 0) {
              canvas.moveTo(x, y)
            } else {
              if (j == f.length - 1) {
                const firstPoint = cache[f[0]]
                canvas.lineTo(firstPoint[0], firstPoint[1])
              } else {
                canvas.lineTo(x, y)
              }
            }
          }
        }
      }

      canvas.stroke()
      canvas.closePath()
    })
  }

  /** Returns this brush's own default options (`model`), merged by `defineOptions()` on top of
   * `CanvasCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return CANVAS_MODEL3D_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.model3d', CanvasModel3DBrush)
