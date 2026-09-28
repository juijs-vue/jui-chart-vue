// Port of legacy `src/brush/canvas/activebubble.js` ("chart.brush.canvas.activebubble", extend:
// "chart.brush.canvas.core") - a physics-collision "swarm of self-expiring bubbles" canvas brush.
// `CanvasActiveBubbleBrush extends CanvasCoreBrush` (jui-graph-ts's real port of
// `chart.brush.canvas.core` - see that file's own header comment: adds `addPolygon()`/
// `drawAfter()` for 3D-polygon brushes, both left unused here, same as the original's own
// `activebubble.js` never touching them).
//
// The local `ActiveBubble` class (collision/gravity simulation driving a set of `MortalBubble`s,
// `base/mortalbubble.ts`) is ported verbatim as a plain (non-`extend`-chain) helper class, exactly
// matching the legacy file's own local (not `jui.define`'d) `ActiveBubble` - it's private wiring
// for this one brush, not a shared registry entry.
//
// **`this.chart.getCache`/`setCache`**: NOT part of `jui-graph-ts`'s narrower `BrushChart`
// interface (`brush/core.ts`'s own header comment: these live on the real `Builder` instance, not
// `CoreBrush` itself, and `BrushChart` only covers what `CoreBrush`'s OWN methods need) - cast
// through a small local `ChartWithCache` interface here, same technique this project's own
// `raycast.ts`/`flame.ts` (widget-side, where `WidgetChart` already declares them) establish for
// cache-consuming registered types.
import { registerBrush, CanvasCoreBrush, colorUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { MortalBubble } from './base/mortalbubble'

interface ChartWithCache {
  getCache(key: string, defValue?: unknown): unknown
  setCache(key: string, value: unknown): void
}

/** `chart.brush.canvas.activebubble`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface CanvasActiveBubbleBrushOptions {
  /** Downward acceleration applied to every bubble each frame, in the collision simulation's own
   * (unitless, canvas-pixel-scaled) force units. */
  gravity?: number
  /** Radius in px of every spawned bubble (all bubbles share one size). */
  radius?: number
  /** Fill opacity of the bubble's solid core (its softer outer ring is always drawn at a fixed
   * lower opacity - see `MortalBubble`). */
  opacity?: number
}

/** Own `chart.brush.canvas.activebubble.setup()` fields - see legacy `activebubble.js`. */
export const CANVAS_ACTIVEBUBBLE_BRUSH_OWN_DEFAULTS: CanvasActiveBubbleBrushOptions = {
  gravity: 0.2,
  radius: 20,
  opacity: 1,
}

function hexToRgba(color: string, opacity: number): string {
  const rgb = colorUtil.rgb(color) as { r: number; g: number; b: number }
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
}

class ActiveBubble {
  renderContext: CanvasRenderingContext2D
  contextWidth: number
  contextHeight: number
  gravity: number
  data: MortalBubble[] = []
  isArrange = false

  constructor(renderContext: CanvasRenderingContext2D, contextWidth: number, contextHeight: number, gravity: number) {
    this.renderContext = renderContext
    this.contextWidth = contextWidth
    this.contextHeight = contextHeight
    this.gravity = gravity
  }

  /** Drops every expired bubble (`active === false`, set by `MortalBubble.draw()` once its
   * lifetime elapses) from `data` in place, then reports whether any bubbles remain. PRESERVED
   * QUIRK (from the legacy source): splicing while iterating forward over the same index skips the
   * element that shifts into the just-removed slot, so an expired bubble immediately followed by
   * another expired bubble can survive one extra frame before being collected. */
  preCheck(): boolean {
    for (let i = 0; i < this.data.length; i++) {
      const bubble = this.data[i]
      if (!bubble.active) {
        this.data.splice(i, 1)
      }
    }

    return this.data.length > 0
  }

  /** Advances the whole swarm by one simulation frame: bails out via `preCheck()` if nothing is
   * left alive, then (1) pushes every bubble with a constant force of magnitude `mass * gravity` in
   * the `[1, 0]` direction and integrates it (PRESERVED QUIRK, also present in the legacy source:
   * despite the field's name and its "downward acceleration" option doc, this force points along
   * the +x axis, not +y - it never actually pulls bubbles down); (2) finds every overlapping pair
   * (circle-circle, `radiusSum - dist > 1`) via a full O(n^2) scan, recording each pair from both
   * iteration orders; sets `isArrange` once a frame produces zero collisions (a "swarm has settled"
   * flag read back below in step 4's branch, and reset to `false` by `drawBefore()` whenever the
   * row count changes, forcing a fresh re-arrangement); (3) de-duplicates the (i,j)/(j,i) pair
   * repeats via the `dups` index list; (4) resolves each unique collision by separating the two
   * bubbles along the unit normal between their centers (half the overlap `size` each, defaulting
   * the normal to straight up when the centers exactly coincide) and applying an asymmetric,
   * non-physically-rigorous velocity/force response that branches on which bubble is further left
   * (`me.pos[0] < other.pos[0]`) - the left one always gets damped (`veloc *= [0.7, 0.99]`) plus a
   * reaction force from the other's current `accel`, while the right one only gets an extra
   * "kick" velocity (`±1` per axis, sign following relative position) when the swarm was
   * previously `isArrange`d; (5) clamps every bubble's position to the canvas bounds - `pos[1]`
   * (y) is clamped on both ends (`[0, contextHeight]`) but `pos[0]` (x) is only clamped at its
   * upper bound (`contextWidth`), so a bubble can still drift to a negative x; (6) finally calls
   * each surviving bubble's own `draw()` with a shared `now` timestamp. */
  draw(): void {
    if (!this.preCheck()) return

    const collisions: [MortalBubble, MortalBubble][] = []
    const dups: number[] = []

    for (let i = 0; i < this.data.length; i++) {
      const bubble = this.data[i]
      const gDirection: [number, number] = [1, 0]
      bubble.force([gDirection[0] * bubble.mass * this.gravity, gDirection[1] * bubble.mass * this.gravity])

      bubble.update()
    }

    for (let i = 0; i < this.data.length; i++) {
      for (let j = 0; j < this.data.length; j++) {
        if (i == j) continue
        const me = this.data[i]
        const other = this.data[j]
        const dist = me.distance(other)
        const radiusSum = me.radius + other.radius
        if (radiusSum - dist > 1) {
          collisions.push([me, other])
        }
      }
    }

    if (collisions.length == 0) {
      this.isArrange = true
    }

    for (let i = 0; i < collisions.length - 1; i++) {
      const me = collisions[i]
      for (let j = i + 1; j < collisions.length; j++) {
        const other = collisions[j]
        if ((me[0] == other[0] && me[1] == other[1]) || (me[1] == other[0] && me[0] == other[1])) {
          dups.push(j)
        }
      }
    }

    for (let i = 0; i < collisions.length; i++) {
      if (dups.indexOf(i) != -1) continue

      const collision = collisions[i]
      const me = collision[0]
      const other = collision[1]
      const radiusSum = me.radius + other.radius
      const dist = me.distance(other)
      let normal: [number, number] = [other.pos[0] - me.pos[0], other.pos[1] - me.pos[1]]
      const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])
      normal = [normal[0] / len, normal[1] / len]
      const size = radiusSum - dist
      if (other.pos[0] == me.pos[0] && other.pos[1] == me.pos[1]) {
        normal = [0, -1]
      }

      me.pos = [-(size / 2) * normal[0] + me.pos[0], -(size / 2) * normal[1] + me.pos[1]]
      other.pos = [(size / 2) * normal[0] + other.pos[0], (size / 2) * normal[1] + other.pos[1]]

      const meForce: [number, number] = [normal[0] * me.accel[0], normal[1] * me.accel[1]]
      const otherForce: [number, number] = [normal[0] * other.accel[0], normal[1] * other.accel[1]]

      if (me.pos[0] < other.pos[0]) {
        me.veloc = [me.veloc[0] * 0.7, me.veloc[1] * 0.99]
        me.force([-otherForce[0], -otherForce[1]])
      } else {
        if (this.isArrange) {
          me.veloc = [other.pos[0] > me.pos[0] ? -1 : 1, other.pos[1] > me.pos[1] ? -1 : 1]
          me.force([-meForce[0], -meForce[1]])
        }

        other.veloc = [other.veloc[0] * 0.7, other.veloc[1] * 0.99]
        other.force([-meForce[0], -meForce[1]])
      }
    }

    const now = new Date().getTime()
    for (let i = 0; i < this.data.length; i++) {
      const me = this.data[i]

      if (me.pos[0] > this.contextWidth) {
        me.pos[0] = this.contextWidth
      }
      if (me.pos[1] > this.contextHeight) {
        me.pos[1] = this.contextHeight
      } else if (me.pos[1] < 0) {
        me.pos[1] = 0
      }

      this.data[i].draw(this.renderContext, now)
    }
  }
}

/** A physics-collision "swarm of self-expiring bubbles" canvas brush: drains queued data rows into
 * new `MortalBubble`s (`base/mortalbubble.ts`) added to a cached `ActiveBubble` simulation instance,
 * then runs one collision/gravity step and renders the whole swarm every frame. Per this file's
 * header comment, `ActiveBubble`'s "gravity" force actually points along +x, not +y, and its
 * collision resolution is an asymmetric, non-physically-rigorous velocity/force response rather than
 * a rigid-body solve. */
export class CanvasActiveBubbleBrush extends CanvasCoreBrush {
  /** Lazily creates the single `ActiveBubble` simulation instance for this brush and caches it on
   * the chart (`getCache`/`setCache('active_bubble', ...)`) so it survives across redraws instead
   * of resetting the whole swarm every frame. Also tracks the row count in a second cache key
   * (`active_bubble_count`); whenever it changes (a row was added/removed since the last draw) the
   * cached simulation's `isArrange` flag is cleared, forcing the collision-resolution "kick" branch
   * in `ActiveBubble.draw()` to run again until the swarm re-settles. */
  drawBefore = (): void => {
    const chart = this.chart as unknown as ChartWithCache
    const activeBubbleCount = chart.getCache('active_bubble_count', 0) as number
    const dataCount = (this.axis.data ?? []).length

    if (chart.getCache('active_bubble') == null) {
      chart.setCache(
        'active_bubble',
        new ActiveBubble(this.canvas as CanvasRenderingContext2D, this.axis.area('width'), this.axis.area('height'), (this.brush as Record<string, unknown>).gravity as number),
      )
    }

    if (activeBubbleCount != dataCount) {
      const activeBubble = chart.getCache('active_bubble') as ActiveBubble
      activeBubble.isArrange = false

      chart.setCache('active_bubble_count', dataCount)
    }
  }

  /** Drains every row currently queued on `this.axis.data` (`shift()`-ing it empty) into new
   * `MortalBubble`s appended to the cached `ActiveBubble` swarm - each bubble's `startTime`/
   * `duration` come from the row's own `startTime`/`duration` fields (defaulting to `Date.now()`/
   * `1000`ms), and its fill/shadow colors are `brush.opacity`/a fixed `0.2` alpha applied to the
   * series color via `hexToRgba`. Once all queued rows are converted, delegates to
   * `ActiveBubble.draw()` to run one physics step and render the whole swarm (not just the newly
   * added bubbles). */
  draw = (): void => {
    const chart = this.chart as unknown as ChartWithCache
    const activeBubble = chart.getCache('active_bubble') as ActiveBubble
    const brush = this.brush as Record<string, unknown>

    let index = 0
    while ((this.axis.data as BrushData[]).length > 0) {
      const color = this.color(index)
      const data = (this.axis.data as BrushData[]).shift() as BrushData
      const startTime = this.getValue(data, 'startTime', Date.now()) as number
      const duration = this.getValue(data, 'duration', 1000) as number

      activeBubble.data.push(
        new MortalBubble(startTime, duration, brush.radius as number, hexToRgba(color, brush.opacity as number), hexToRgba(color, 0.2)),
      )
      index++
    }

    activeBubble.draw()
  }

  /** Returns this brush's own default options (`gravity`/`radius`/`opacity`), merged by
   * `defineOptions()` on top of `CanvasCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return CANVAS_ACTIVEBUBBLE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.activebubble', CanvasActiveBubbleBrush)
