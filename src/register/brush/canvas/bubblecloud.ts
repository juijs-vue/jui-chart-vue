// Port of legacy `src/brush/canvas/bubblecloud.js` ("chart.brush.canvas.bubblecloud", extend:
// "chart.brush.canvas.core") - a "force-directed labeled bubble cloud" canvas brush (bubbles sized
// by a `capacity` field, gravitating toward center, colliding/separating from each other), plus a
// hover-pick hookup (`chart.setCache('picker', {obj, func})`) consumed by `canvas.picker`
// (`widget/canvas/picker.ts`) via `chart.getCache('picker')`.
//
// The local `BubbleCloud` class is ported verbatim as a plain (non-`extend`-chain) helper,
// building on `Bubble` (`base/bubble.ts`, ported from legacy `base/bubble.js`).
import { registerBrush, CanvasCoreBrush, colorUtil } from 'jui-graph-ts'
import type { BrushData, BrushOptions } from 'jui-graph-ts'
import { Bubble } from './base/bubble'

/** `chart.brush.canvas.bubblecloud` declares no `static setup()`/config fields of its own - every
 * bubble's size/color/label is instead derived per-row from `title`/`capacity` data fields (see
 * `CanvasBubbleCloudBrush.draw()`). Re-exported as an alias for `jui-graph-ts`'s base
 * `BrushOptions` purely so a future `jui-api-doc` page for `"canvas.bubblecloud"` has a named type
 * to point at. */
export type CanvasBubbleCloudBrushOptions = BrushOptions

interface ChartWithCache {
  getCache(key: string, defValue?: unknown): unknown
  setCache(key: string, value: unknown): void
}

function hexToRgba(color: string, opacity: number): string {
  const rgb = colorUtil.rgb(color) as { r: number; g: number; b: number }
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
}

interface BubbleCloudDatum {
  name: string
  count: number
  color: string
  shadowColor: string
  textColor: string
  textStyle: string
  origin: BrushData
}

class BubbleCloud {
  renderContext: CanvasRenderingContext2D
  contextWidth: number
  contextHeight: number
  bubbles: Record<string, Bubble | BubbleCloudDatum> = {}
  animationAlpha = 0.1
  hoverBubble: Bubble | null = null

  constructor(renderContext: CanvasRenderingContext2D, contextWidth: number, contextHeight: number) {
    this.renderContext = renderContext
    this.contextWidth = contextWidth
    this.contextHeight = contextHeight
  }

  /** Reconciles the live `bubbles` map against a fresh `nextData` row set, keyed by `name`. Every
   * existing bubble is first unmarked; each incoming row either creates a brand-new `Bubble` (sized
   * via `radiusSize()`, given a random starting `pos` so new bubbles enter from an arbitrary point
   * rather than the origin) or, for a `name` that already has a bubble, just re-marks it and only
   * actually applies the recomputed radius when it drifted by more than `20`px (avoiding
   * jittery/near-continuous radius churn from tiny `capacity` fluctuations). Any bubble left
   * unmarked afterward (present before, absent from `nextData`) is deleted. `radiusSize(c)` scales
   * a bubble's radius by its share of the total `capacity` across all rows (`c / count`) against a
   * base proportional to the canvas's shorter dimension (`(min(width,height)/6)`), plus a flat
   * `+50`px floor so even a tiny share stays visible. Whenever anything actually changed (a bubble
   * was added, removed, or meaningfully resized), `animationAlpha` is reset to `0.1` so `draw()`'s
   * center-gravity pull re-engages instead of staying settled at `0`. */
  processData(nextData: BubbleCloudDatum[] | null): void {
    if (nextData == null) return

    let count = nextData.reduce((a, b) => a + b.count, 0)
    let isChanged = false

    for (const key in this.bubbles) (this.bubbles[key] as Bubble).mark = false

    const radiusSize = (c: number): number => {
      const s = this.contextWidth > this.contextHeight ? this.contextHeight : this.contextWidth
      return (c / count) * (s / 6) + 50
    }

    nextData.forEach((e) => {
      const existing = this.bubbles[e.name] as Bubble | undefined
      if (existing == null) {
        const bubble = new Bubble(radiusSize(e.count), e.name, e.color, e.shadowColor, e.textColor, e.textStyle)
        bubble.data = e
        bubble.mark = true
        bubble.pos = [Math.random() * this.contextWidth, Math.random() * this.contextHeight]

        this.bubbles[e.name] = bubble
        isChanged = true
      } else {
        existing.mark = true
        const newRadius = radiusSize(e.count)

        if (Math.abs(existing.radius - newRadius) > 20) {
          existing.radius = newRadius
          isChanged = true
        }
      }
    })

    for (const key in this.bubbles) {
      const bubble = this.bubbles[key] as Bubble
      if (!bubble.mark) {
        delete this.bubbles[key]
        isChanged = true
      }
    }

    if (isChanged) this.animationAlpha = 0.1
  }

  /** Discards every existing bubble and rebuilds the whole set from `data` via `processData()` -
   * used only for the very first population of a fresh `BubbleCloud` instance (see
   * `CanvasBubbleCloudBrush.draw()`), since starting from an empty map makes every row look "new"
   * and so seeds every bubble with a random `pos`. */
  start(data: BubbleCloudDatum[]): void {
    this.bubbles = {}
    this.processData(data)
  }

  /** Runs one animation frame for the whole cloud. `animationAlpha` (reset to `0.1` by
   * `processData()` on any real change) decays multiplicatively by `0.99` per call and is clamped
   * to a `0` floor - each bubble is nudged toward the canvas center by `animationAlpha` times the
   * vector to center, so the pull is strong right after a change and fades to a standstill as the
   * cloud settles. Every distinct bubble pair closer than `radius sum + 4`px (`collisionPadding`)
   * is then separated directly by mutating `pos` (not via `force()`/velocity) proportionally to how
   * much they overlap, scaled by a `jitter` factor of `0.5`, so overlapping bubbles push apart
   * gradually rather than snapping fully clear in one frame. Each bubble's own `update()` is called
   * afterward for interface parity with `KineticObject`, but since nothing here ever calls
   * `force()` on these bubbles their `veloc` stays `[0, 0]`, so `update()` has no visible effect
   * beyond clearing `accel`. Finally each bubble's `dim` flag is set whenever a different bubble is
   * currently hovered (`hoverBubble`), and every bubble is drawn with a shared `now` timestamp. */
  draw(): void {
    this.animationAlpha *= 0.99

    const bubbles = Object.values(this.bubbles) as Bubble[]
    if (this.animationAlpha < 0) this.animationAlpha = 0

    const center: [number, number] = [this.contextWidth / 2, this.contextHeight / 2]
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i]
      const g: [number, number] = [center[0] - bubble.pos[0], center[1] - bubble.pos[1]]
      bubble.pos = [bubble.pos[0] + g[0] * this.animationAlpha, bubble.pos[1] + g[1] * this.animationAlpha]
    }

    const jitter = 0.5
    const collisionPadding = 4

    for (let i = 0; i < bubbles.length; i++) {
      for (let j = 0; j < bubbles.length; j++) {
        if (i == j) continue
        const me = bubbles[i]
        const other = bubbles[j]
        const dist = me.distance(other)
        const minDist = me.radius + other.radius + collisionPadding
        if (dist < minDist) {
          const d = ((dist - minDist) / dist) * jitter
          const dx = (me.pos[0] - other.pos[0]) * d
          const dy = (me.pos[1] - other.pos[1]) * d

          me.pos[0] -= dx
          me.pos[1] -= dy
          other.pos[0] += dx
          other.pos[1] += dy
        }
      }
    }

    const now = new Date().getTime()
    for (let i = 0; i < bubbles.length; i++) {
      const me = bubbles[i]
      me.update()
      me.dim = !!(this.hoverBubble && this.hoverBubble != me)

      bubbles[i].draw(this.renderContext, now)
    }
  }

  /** Hover hit-test consumed by `canvas.picker` (via the `'picker'` chart cache entry
   * `CanvasBubbleCloudBrush.draw()` registers): finds the first bubble (in `Object.values`
   * insertion order) whose center is within its own `radius` of `(x, y)`, stores it on
   * `hoverBubble` (clearing it to `null` when no bubble matches, so `draw()`'s `dim` logic
   * un-highlights everything once the pointer leaves), and returns that bubble's original data row
   * (`.data.origin`) or `null`. */
  pick(x: number, y: number): BrushData | null {
    let isHover = false

    const bubbles = Object.values(this.bubbles) as Bubble[]
    for (let i = 0; i < bubbles.length; i++) {
      const d = bubbles[i].distancePos([x, y])
      if (d < bubbles[i].radius) {
        this.hoverBubble = bubbles[i]
        isHover = true
        break
      }
    }

    if (!isHover) this.hoverBubble = null

    return this.hoverBubble != null ? ((this.hoverBubble.data as BubbleCloudDatum).origin ?? null) : null
  }
}

/** A "force-directed labeled bubble cloud" canvas brush: builds a `BubbleCloud` (this file's local
 * helper, built on `Bubble` from `base/bubble.ts`) where each bubble is sized by a row's `capacity`
 * field, gravitates toward the canvas center, and collides/separates from its neighbors. Reuses and
 * re-animates the cached cloud across redraws when the underlying data reference hasn't changed, and
 * registers a `'picker'` chart-cache hook so `canvas.picker` can route pointer hover events into the
 * cloud's own hit-testing. */
export class CanvasBubbleCloudBrush extends CanvasCoreBrush {
  /** Reuses the cached `BubbleCloud` (just re-running its physics/render step) when one already
   * exists and the chart's `axis.data` reference hasn't changed since it was built; otherwise
   * builds a brand-new one from scratch. On a rebuild, every data row is converted into a
   * `BubbleCloudDatum` keyed by its `title` field (`name`, defaulting to `"Unknown"`) with `count`
   * from `capacity` (default `1`), a series color plus a `0.2`-alpha shadow tint, and label styling
   * pulled from the `bubbleCloudFontColor`/`bubbleCloudFontWeight`/`bubbleCloudFontSize`/
   * `fontFamily` theme keys; the resulting cloud is seeded via `start()`, drawn once immediately,
   * and cached (`'bubble_cloud'`) alongside the `axis.data` reference used for the reuse check
   * (`'bubble_data'`) and a `'picker'` entry (`{ obj, func }`) that `canvas.picker` reads to route
   * pointer hover events into `bubbleCloud.pick()`. */
  draw = (): void => {
    const chart = this.chart as unknown as ChartWithCache
    let bubbleCloud = chart.getCache('bubble_cloud') as BubbleCloud | null
    const bubbleData = chart.getCache('bubble_data')

    if (bubbleCloud != null && bubbleData != null && bubbleData == this.axis.data) {
      bubbleCloud.draw()
    } else {
      bubbleCloud = new BubbleCloud(this.canvas as CanvasRenderingContext2D, this.axis.area('width'), this.axis.area('height'))

      this.eachData((data, index) => {
        const row = data as BrushData
        const i = index as number
        const color = this.color(i)
        const name = this.getValue(row, 'title', 'Unknown') as string
        const count = this.getValue(row, 'capacity', 1) as number

        const bubbleDatum: BubbleCloudDatum = {
          name,
          count,
          color,
          shadowColor: hexToRgba(color, 0.2),
          textColor: this.chart.theme('bubbleCloudFontColor') as string,
          textStyle: `${this.chart.theme('bubbleCloudFontWeight')} ${this.chart.theme('bubbleCloudFontSize')}px ${this.chart.theme('fontFamily')}`,
          origin: row,
        }

        ;(bubbleCloud as BubbleCloud).bubbles[name] = bubbleDatum
      })

      bubbleCloud.start(Object.values(bubbleCloud.bubbles) as BubbleCloudDatum[])
      bubbleCloud.draw()

      chart.setCache('picker', { obj: bubbleCloud, func: bubbleCloud.pick })
      chart.setCache('bubble_cloud', bubbleCloud)
      chart.setCache('bubble_data', this.axis.data)
    }
  }
}

registerBrush('canvas.bubblecloud', CanvasBubbleCloudBrush)
