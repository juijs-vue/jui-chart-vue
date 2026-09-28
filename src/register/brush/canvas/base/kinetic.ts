// Port of legacy `src/brush/canvas/base/kinetic.js` ("util.canvas.base.kinetic", extend: null) -
// a plain physics-vector helper class (mass/friction/position/velocity/acceleration), shared by
// `base/bubble.js` ("util.canvas.base.bubble") and `base/mortalbubble.js`
// ("util.canvas.base.mortalbubble"), both of which `extend: "util.canvas.base.kinetic"`. Not part
// of any `chart.*` `extend` chain (`jui-graph-ts` doesn't register/export it, since it's a
// `jui-chart`-OWN canvas-brush helper, not a `juijs-graph` engine primitive) - ported here as a
// real ES class per this project's own established convention (Phase 0 rule 2 in `jui-graph-ts`,
// followed throughout this project's `register/` tree), imported directly by `base/bubble.ts`/
// `base/mortalbubble.ts` rather than looked up through any registry.
/** A plain physics-vector helper class (mass/friction/position/velocity/acceleration) shared by
 * `base/bubble.ts`'s `Bubble` and `base/mortalbubble.ts`'s `MortalBubble`, both of which extend it.
 * Provides force accumulation (`force()`), Euclidean distance/direction helpers, and a simple
 * velocity/position integrator (`update()`) with a preserved quirk: `pos` only advances on an axis
 * once `|veloc|` exceeds `2`, so slow motion can "snap" forward rather than easing in smoothly. Not
 * part of any `jui-graph-ts` `chart.*` class chain - a `jui-chart`-own canvas-brush helper. */
export class KineticObject {
  mass = 10
  friction = 0.1
  pos: [number, number] = [0, 0]
  veloc: [number, number] = [0, 0]
  accel: [number, number] = [0, 0]

  /** Accumulates an instantaneous force `f` into `accel` using Newton's second law (`a += f/m`),
   * added onto whatever acceleration was already queued this frame rather than replacing it - so
   * multiple `force()` calls before an `update()` combine additively. */
  force(f: [number, number]): void {
    this.accel = [this.accel[0] + f[0] / this.mass, this.accel[1] + f[1] / this.mass]
  }

  /** Magnitude (Euclidean length) of the current `accel` vector. */
  accelScalar(): number {
    return Math.sqrt(this.accel[0] * this.accel[0] + this.accel[1] * this.accel[1])
  }

  /** Magnitude (Euclidean length) of the current `veloc` vector. */
  velocScalar(): number {
    return Math.sqrt(this.veloc[0] * this.veloc[0] + this.veloc[1] * this.veloc[1])
  }

  /** Kinetic-energy-shaped drag force (`0.5 * mass * veloc^2` per axis, signed back toward the
   * direction of travel via `xDir`/`yDir`) - used by callers as a velocity-dependent counter-force
   * (e.g. air resistance) that grows quadratically as speed increases. */
  velocityForce(): [number, number] {
    const xDir = this.veloc[0] < 0 ? -1 : 1
    const yDir = this.veloc[1] < 0 ? -1 : 1
    return [xDir * 0.5 * this.mass * this.veloc[0] * this.veloc[0], yDir * 0.5 * this.mass * this.veloc[1] * this.veloc[1]]
  }

  /** Euclidean distance from this object's `pos` to the given point. */
  distancePos(pos: [number, number]): number {
    return Math.sqrt(Math.pow(this.pos[0] - pos[0], 2) + Math.pow(this.pos[1] - pos[1], 2))
  }

  /** Euclidean distance from this object's `pos` to another object's `pos`. */
  distance(other: { pos: [number, number] }): number {
    return this.distancePos(other.pos)
  }

  /** Unit vector pointing from `pos` back toward this object's own `pos` (i.e. away from `pos`,
   * not toward it - note the subtraction order is `this.pos - pos`). Returns `[0, 0]` when the two
   * points coincide, to avoid a divide-by-zero. */
  direction(pos: [number, number]): [number, number] {
    const distance = this.distancePos(pos)
    if (distance == 0) return [0, 0]
    return [(this.pos[0] - pos[0]) / distance, (this.pos[1] - pos[1]) / distance]
  }

  /** Magnitude (Euclidean length) of the current `veloc` vector - equivalent to `velocScalar()`. */
  speed(): number {
    return Math.sqrt(Math.pow(this.veloc[0], 2) + Math.pow(this.veloc[1], 2))
  }

  /** Integrates one simulation step: adds the accumulated `accel` into `veloc`, then advances
   * `pos` by the new `veloc` on each axis independently - but only on axes where `|veloc|` exceeds
   * `2`, so slow-moving objects freeze in place rather than drifting by sub-pixel amounts (PRESERVED
   * QUIRK: below that threshold `veloc` keeps accumulating internally while `pos` stays put, so
   * motion can "snap" forward once the threshold is crossed rather than easing in smoothly). Clears
   * `accel` back to `[0, 0]` at the end so the next frame's `force()` calls start fresh. */
  update(): void {
    this.veloc = [this.veloc[0] + this.accel[0], this.veloc[1] + this.accel[1]]

    let x = this.pos[0]
    let y = this.pos[1]

    if (Math.abs(this.veloc[0]) > 2) {
      x = this.pos[0] + this.veloc[0]
    }
    if (Math.abs(this.veloc[1]) > 2) {
      y = this.pos[1] + this.veloc[1]
    }

    this.pos = [x, y]
    this.accel = [0, 0]
  }

  /** No-op base implementation - `KineticObject` itself has nothing visual to render; subclasses
   * (`Bubble`, `MortalBubble`) override this to actually draw. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  draw(_context: CanvasRenderingContext2D, _now: number): void {}
}
