// Port of legacy `src/brush/canvas/activecircle.js` ("chart.brush.canvas.activecircle", extend:
// "chart.brush.canvas.core") - a simple per-row kinematic circle brush (constant-velocity motion,
// no real physics integration despite the unused `checkForMotion`/`calcAcceleration`/mass-to-weight
// helpers the legacy source carries - see the local `Circle` class below, ported byte-faithfully
// including that dead code).
//
// **Preserved-but-dropped noise, NOT a behavior change**: the legacy `Circle.checkForMotion`/
// `calcAcceleration`/`move` bodies contain several `console.log(\`...\`)` debug prints (Korean-
// language, clearly ad-hoc developer scratch logging, not load-bearing for any return value or
// control flow - confirmed by reading each: they interpolate already-computed locals purely for
// side-effect printing). Dropped here rather than reproduced, unlike this project's other
// "PRESERVED QUIRK"/"PRESERVED BUG" conventions (which apply to actual return-value/control-flow
// divergences) - a chart library spamming the browser console on every animation frame is not a
// behavior worth preserving, and every numeric computation those `console.log` calls read from is
// still computed and used exactly as the original does.
import { registerBrush, CanvasCoreBrush, canvasBaseUtil, colorUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

interface ChartWithCache {
  getCache(key: string, defValue?: unknown): unknown
  setCache(key: string, value: unknown): void
}

/** Minimal shape `Circle`/`CanvasActiveCircleBrush` need from a rendered axis scale - a callable
 * `(value) => pixel`, plus the `min()`/`max()` domain-endpoint accessors `chart.axis.x.min()`/
 * `.max()` real scale objects expose (confirmed via legacy `checkWallCollision`'s own usage). */
type ScaleWithMinMax = ((value: unknown) => number) & { min(): unknown; max(): unknown }

/** `chart.brush.canvas.activecircle`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface CanvasActiveCircleBrushOptions {
  /** Fallback radius in px used when a row doesn't supply its own `radius` field. */
  radius?: number
}

/** Own `chart.brush.canvas.activecircle.setup()` fields - see legacy `activecircle.js`. */
export const CANVAS_ACTIVECIRCLE_BRUSH_OWN_DEFAULTS: CanvasActiveCircleBrushOptions = {
  radius: 20,
}

function hexToRgba(color: string, opacity: number): string {
  const rgb = colorUtil.rgb(color) as { r: number; g: number; b: number }
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
}

class Circle {
  radius = 1
  position: [number, number] = [0, 0]
  velocity: [number, number] = [0, 0]
  acceleration: [number, number] = [0, 0]

  gravity = -9.8
  mass = 1
  weight = 1
  friction = 0.1
  runtime = 0

  private context: CanvasRenderingContext2D
  private scale: { x: (v: unknown) => number; y: (v: unknown) => number }
  private color: string
  private xValue: unknown
  private yValue: unknown

  constructor(context: CanvasRenderingContext2D, scale: { x: (v: unknown) => number; y: (v: unknown) => number }, color: string, xValue: unknown, yValue: unknown) {
    this.context = context
    this.scale = scale
    this.color = color
    this.xValue = xValue
    this.yValue = yValue
  }

  /** Converts a mass to a weight (`mass * gravity`, `gravity` defaulting to this circle's own
   * `-9.8` field). Dead code per this file's header - never called anywhere in this brush (the
   * legacy source's only call site is inside `calcAcceleration`, and `calcAcceleration` itself is
   * never invoked live). */
  massToWeight(mass: number, gravity = this.gravity): number {
    return mass * gravity
  }

  /** Inverse of `massToWeight`: recovers a mass from a weight by dividing out `gravity`. Dead
   * code per this file's header - unreachable from `draw()`. */
  weightToMass(weight: number): number {
    return weight / this.gravity
  }

  /** Converts a value in pounds-force to newtons (`pound / 0.2248`). Dead code per this file's
   * header - unreachable from `draw()`. */
  poundToWeight(pound: number): number {
    return pound * (1 / 0.2248)
  }

  /** Inverse of `poundToWeight`: converts newtons back to pounds-force. Dead code per this
   * file's header - unreachable from `draw()`. */
  weightToPound(weight: number): number {
    return weight * (0.2248 / 1)
  }

  /** Inclined-plane static-friction check: true when the along-slope component of this circle's
   * weight (`weight * sin(angle)`) exceeds the maximum static friction resisting it
   * (`fricCoeff * weight * cos(angle)`), i.e. whether the object would start sliding down a slope
   * tilted at `angle` degrees. Dead code per this file's header - the legacy source only ever
   * called this from a commented-out `if` in `draw()`, so it (and the `acceleration[1]` write that
   * would follow it) never runs. */
  checkForMotion(angle: number, fricCoeff: number): boolean {
    const weight = this.massToWeight(this.mass, this.gravity)
    const normal = weight * Math.cos((angle * Math.PI) / 180)
    const perpForce = weight * Math.sin((angle * Math.PI) / 180)
    const statFriction = fricCoeff * normal

    return perpForce > statFriction
  }

  /** Inclined-plane kinetic-friction acceleration: the net along-slope force (gravity component
   * minus kinetic friction) divided by mass, using the *current* `acceleration[1]` in place of
   * `gravity` when computing the notional "weight" (so this isn't a fixed-gravity result, unlike
   * `checkForMotion`). Dead code per this file's header - same unreachable commented-out call site
   * as `checkForMotion`. */
  calcAcceleration(angle: number, fricCoeff: number): number {
    const weight = this.massToWeight(this.mass, this.acceleration[1])
    const normal = weight * Math.cos((angle * Math.PI) / 180)
    const perpForce = weight * Math.sin((angle * Math.PI) / 180)
    const kinFriction = fricCoeff * normal
    const totalForce = perpForce - kinFriction

    return totalForce / this.mass
  }

  /** Recomputes this circle's pixel `position` from its original data-space `xValue`/`yValue`
   * offset by straight-line displacement (`velocity * runtime`) plus an acceleration term
   * (`acceleration * runtime^2` - note this is `a*t^2`, not the usual `0.5*a*t^2`, exactly as the
   * legacy source computes it) before mapping through the axis `scale`. Called by `move()` on every
   * frame where it actually runs. */
  updateAcceleration(): void {
    const vx = this.velocity[0] * this.runtime
    const vy = this.velocity[1] * this.runtime
    const ax = this.acceleration[0] * Math.pow(this.runtime, 2)
    const ay = this.acceleration[1] * Math.pow(this.runtime, 2)

    this.position[0] = this.scale.x((this.xValue as number) + vx + ax)
    this.position[1] = this.scale.y((this.yValue as number) + vy + ay)
  }

  /** Advances motion for one frame: accumulates elapsed time into `runtime` (scaled by `tpf`,
   * time-per-frame) and re-derives `position` via `updateAcceleration()`. PRESERVED QUIRK: bails
   * out with no effect at all whenever `tpf == 1` - since the owning brush's `draw()` reads `tpf`
   * from a chart cache that defaults to exactly `1` when nothing else sets it, circles never move
   * unless something elsewhere in the chart populates a `'tpf'` cache value different from `1`.
   * `_fps` is accepted (matching the legacy signature) but never read. */
  move(_fps: number, tpf: number): void {
    if (tpf == 1) return

    this.runtime += 1 * tpf
    this.updateAcceleration()
  }

  /** Resets `velocity` and `acceleration` to zero, freezing further motion (`position` itself is
   * left untouched, and nothing in this file calls `stop()`). */
  stop(): void {
    this.velocity = [0, 0]
    this.acceleration = [0, 0]
  }

  /** Draws this circle as a drop-shadowed filled circle at its current `position`/`radius`/
   * `color` via `jui-graph-ts`'s `CanvasBase.drawCircle`, with the shadow tinted from `color` at a
   * fixed `0.3` alpha. */
  draw(): void {
    const util = new canvasBaseUtil.CanvasBase(this.context)

    this.context.shadowColor = hexToRgba(this.color, 0.3)
    this.context.shadowBlur = 10
    this.context.shadowOffsetX = 0
    this.context.shadowOffsetY = 10
    this.context.globalAlpha = 1.0

    util.drawCircle(this.position[0], this.position[1], this.radius, this.color)
  }
}

/** Draws one simple kinematic `Circle` per data row, seeded from each row's `x`/`y`/`radius`/`vx`/
 * `vy`/`ax`/`ay` fields and cached on the chart so the same instances persist across redraws. Each
 * frame calls every circle's `move()`/`draw()`; per this file's header comment, `Circle` only
 * performs constant-velocity motion (`move()` bails out whenever `tpf == 1`, which is its cached
 * default, so circles never actually move unless something else populates that cache) - the
 * inclined-plane friction/acceleration helpers and wall-collision detection it also carries are dead
 * code, never invoked. */
export class CanvasActiveCircleBrush extends CanvasCoreBrush {
  /** Reports whether `circle` has crossed any of the four axis-range boundaries (its edge, `pos ±
   * radius`, past the mapped pixel position of `axis.x`/`axis.y`'s own `min()`/`max()`). Note the
   * y comparisons are swapped relative to the x ones (`position[1] - radius < maxY` /
   * `position[1] + radius > minY`), matching canvas y increasing downward while the data-domain
   * "max" maps to the smaller pixel y. Dead code: nothing in this file (or the legacy source)
   * ever calls it, so wall collisions are never actually detected or acted on - circles can drift
   * arbitrarily far past the axis bounds. */
  checkWallCollision(circle: Circle): boolean {
    const x = this.axis.x as ScaleWithMinMax
    const y = this.axis.y as ScaleWithMinMax
    const minX = x(x.min())
    const maxX = x(x.max())
    const minY = y(y.min())
    const maxY = y(y.max())

    return circle.position[0] - circle.radius < minX || circle.position[0] + circle.radius > maxX || circle.position[1] - circle.radius < maxY || circle.position[1] + circle.radius > minY
  }

  /** Builds one `Circle` per data row on the first call (cached on the chart as `'active_circle'`
   * so later redraws reuse the same instances instead of resetting their `runtime`/`position`) -
   * each seeded from the row's own `x`/`y`/`radius`/`vx`/`vy`/`ax`/`ay` fields (radius/velocity/
   * acceleration falling back to `brush.radius`/`0`/`0` when absent). Every frame then calls each
   * circle's `move(fps, tpf)` (reading `fps`/`tpf` from chart cache, both defaulting to `1`) and
   * `draw()`, and writes the (possibly still-empty, per `move()`'s `tpf == 1` quirk) circle list
   * back to the cache. */
  draw = (): void => {
    const chart = this.chart as unknown as ChartWithCache
    const fps = chart.getCache('fps', 1) as number
    const tpf = chart.getCache('tpf', 1) as number
    const circles = (chart.getCache('active_circle', []) as Circle[]) ?? []
    const brush = this.brush as Record<string, unknown>

    if (circles.length == 0) {
      this.eachData((data, i) => {
        const row = data as BrushData
        const index = i as number
        const circle = new Circle(this.canvas as CanvasRenderingContext2D, { x: this.axis.x as (v: unknown) => number, y: this.axis.y as (v: unknown) => number }, this.color(index), row.x, row.y)
        circle.radius = (row.radius as number) || (brush.radius as number)
        circle.position = [(this.axis.x as (v: unknown) => number)(row.x), (this.axis.y as (v: unknown) => number)(row.y)]
        circle.velocity = [(row.vx as number) || 0, (row.vy as number) || 0]
        circle.acceleration = [(row.ax as number) || 0, (row.ay as number) || 0]
        circles.push(circle)
      })
    }

    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i]
      circle.move(fps, tpf)
      circle.draw()
    }

    chart.setCache('active_circle', circles)
  }

  /** Returns this brush's own default options (`radius`), merged by `defineOptions()` on top of
   * `CanvasCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return CANVAS_ACTIVECIRCLE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.activecircle', CanvasActiveCircleBrush)
