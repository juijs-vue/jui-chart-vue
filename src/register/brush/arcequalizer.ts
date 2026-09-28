// Port of legacy `src/brush/arcequalizer.js` ("chart.brush.arcequalizer", extend:
// "chart.brush.core") - extends `CoreBrush` directly, genuinely independent from `equalizer.js`/
// `equalizerbar.js`/`equalizercolumn.js`/`pie.js`/`donut.js` despite the naming overlap (confirmed
// from source and cross-checked against `main` branch's `useArcEqualizer.ts` header comment, which
// independently reached the same conclusion). Uses the auto-registered "panel" `axis.c(0)` grid,
// same as `PieBrush`/`BarGaugeBrush`. Splits the full circle into EQUAL angular wedges, one per
// data ROW (`360 / dataCount`, NOT value-weighted like `PieBrush`'s slice angles); within each
// row's wedge, every target stacks radially outward from a fixed inner hole (`textRadius`) as small
// fixed-thickness annular-sector "blocks" (count = `Math.ceil(stackCount * value/maxValue)`, a flat
// ratio-vs-configured-maximum - no leftover/partial-block case, unlike `equalizer.js`'s pixel-fill
// math). `polarToCartesian`/`describeArc` are ported as literal private helpers (not substituted
// with `jui-graph-ts`'s `mathUtil.rotate`/`radian`, even though `main`'s own cross-check confirmed
// they're algebraically equivalent - kept as the legacy engine's own exact formula for byte-level
// fidelity, avoiding any incidental floating-point difference from a differently-shaped equivalent
// computation).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

/** `chart.brush.arcequalizer`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface ArcEqualizerBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `arcequalizer.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** The value a row's wedge is considered "full" at (its block count reaches `stackCount`): a
   * fixed number, or a function returning one. */
  maxValue?: number | ((...args: unknown[]) => number)
  /** Number of annular-sector "blocks" a fully-lit wedge (value === `maxValue`) is divided into
   * radially. */
  stackCount?: number
  /** Radius in px of the empty center hole each wedge's blocks stack outward from. */
  textRadius?: number
  /** Formats the value shown in each wedge's center label; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.arcequalizer.setup()` fields - see legacy `arcequalizer.js`. */
export const ARC_EQUALIZER_BRUSH_OWN_DEFAULTS: ArcEqualizerBrushOptions = {
  clip: false,
  maxValue: 100,
  stackCount: 25,
  textRadius: 50,
  format: null,
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

/** `chart.brush.arcequalizer`: splits the full circle into one equal angular wedge per data row
 * (`360 / dataCount`, not value-weighted like a pie's slices), and within each wedge stacks
 * fixed-thickness annular-sector "blocks" radially outward from a fixed inner hole (`textRadius`)
 * per target, with the block count a flat ratio of value to `maxValue` (`Math.ceil(stackCount *
 * value/maxValue)`, no partial-block fill). A centered text label shows the summed total across all
 * rows/targets. See this file's own header comment for why it's a genuinely independent
 * implementation from `equalizer`/`equalizerbar`/`equalizercolumn`/`donut` despite the naming
 * overlap. */
export class ArcEqualizerBrush extends CoreBrush {
  private g: any
  private r = 0
  private cx = 0
  private cy = 0
  private stackSize = 0
  private stackAngle = 0
  private dataCount = 0

  /** Converts a `[startAngle, endAngle)` degree span at the given `radius` into the two endpoints
   * (`sx,sy` at `startAngle`, `ex,ey` at `endAngle`, despite the swapped local variable names used
   * to build them) plus a large-arc flag (`sweep`, true once the span exceeds 180°) that
   * `drawPath()` feeds straight into its SVG `Arc()` calls. When the span is exactly a full circle
   * (360°) `endAngle` is nudged down to `359.9` first, since an SVG arc command degenerates to a
   * single point (nothing drawn) when its two endpoints coincide. */
  private describeArc(radius: number, startAngle: number, endAngle: number): { sx: number; sy: number; ex: number; ey: number; sweep: boolean } {
    if (endAngle - startAngle === 360) {
      endAngle = 359.9
    }

    const start = polarToCartesian(this.cx, this.cy, radius, endAngle)
    const end = polarToCartesian(this.cx, this.cy, radius, startAngle)
    const arcSweep = endAngle - startAngle <= 180 ? false : true

    return {
      sx: end.x,
      sy: end.y,
      ex: start.x,
      ey: start.y,
      sweep: arcSweep,
    }
  }

  /** Appends one annular-sector "block" to path `p`, spanning `[startAngle, endAngle)` between
   * `radius` and `radius + this.stackSize`: moves to the inner arc's start point, arcs along the
   * inner radius, draws a straight line out to the outer arc, arcs back along the outer radius,
   * then closes the path back to the inner start point. `draw()` calls this once per stacked block
   * within a row's wedge. */
  private drawPath(p: any, radius: number, startAngle: number, endAngle: number): void {
    const arc1 = this.describeArc(radius, startAngle, endAngle)
    const arc2 = this.describeArc(radius + this.stackSize, startAngle, endAngle)

    p.MoveTo(arc1.sx, arc1.sy)
    p.Arc(radius, radius, 0, arc1.sweep, 1, arc1.ex, arc1.ey)
    p.LineTo(arc2.ex, arc2.ey)
    p.Arc(radius + this.stackSize, radius + this.stackSize, 0, arc2.sweep, 0, arc2.sx, arc2.sy)
    p.LineTo(arc1.sx, arc1.sy)
    p.ClosePath()
  }

  /** Resolves `brush.maxValue` (running it once per row via `eachData()` and keeping the running
   * maximum, when it's a function) and, for every row/target pair, converts `value / maxValue`
   * into a block count via `Math.ceil(stackCount * rate)`. Also sums every target's raw value
   * across every row into `total`, used by `draw()` for the center label. When there is no data at
   * all (`stackData` stays empty since `eachData()` never iterates), synthesizes a single
   * placeholder row where only the first target gets a full `stackCount` blocks and the rest get
   * `0`, so `draw()` still has something to render instead of an empty circle. */
  private calculateData(): { total: number; data: number[][] } {
    let total = 0
    const targets = this.brush.target ?? []
    let maxValue = (this.brush as Record<string, unknown>).maxValue as number | ((...args: unknown[]) => number)
    const stackData: number[][] = []

    if (typeof maxValue === 'function') {
      let resolvedMax = 0

      this.eachData((data) => {
        resolvedMax = Math.max(resolvedMax, (maxValue as (...args: unknown[]) => number).call(this, data))
      })

      maxValue = resolvedMax
    }

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      stackData[index] = []

      for (let j = 0; j < targets.length; j++) {
        const key = targets[j]
        const rate = (row[key] as number) / (maxValue as number)

        total += row[key] as number
        stackData[index][j] = Math.ceil(((this.brush as Record<string, unknown>).stackCount as number) * rate)
      }
    })

    if (stackData.length == 0) {
      stackData[0] = []

      for (let j = 0; j < targets.length; j++) {
        stackData[0][j] = j == 0 ? ((this.brush as Record<string, unknown>).stackCount as number) : 0
      }
    }

    return { total, data: stackData }
  }

  /** Computes this render pass's layout: creates the group, reads the "panel" axis's `axis.c(0)`
   * area, and derives the circle radius (`r`, half the shorter of width/height) and center
   * (`cx`/`cy`, shifted by half the width/height difference so the circle stays centered within a
   * non-square panel). Also caches `dataCount` (row count), `stackSize` (radial thickness per
   * block, `(r - textRadius) / stackCount`), and `stackAngle` (degrees per row's wedge,
   * `360 / dataCount`, guarded to `360 / 1` when there is no data to avoid a division by zero). */
  drawBefore = (): void => {
    this.g = this.svg.group()

    const area = (this.axis.c as unknown as (i: number) => { width: number; height: number })(0)
    const dist = Math.abs(area.width - area.height)

    this.r = Math.min(area.width, area.height) / 2
    this.cx = this.r + (area.width > area.height ? dist / 2 : 0)
    this.cy = this.r + (area.width < area.height ? dist / 2 : 0)

    this.dataCount = this.listData().length
    this.stackSize = (this.r - ((this.brush as Record<string, unknown>).textRadius as number)) / ((this.brush as Record<string, unknown>).stackCount as number)
    this.stackAngle = 360 / (this.dataCount == 0 ? 1 : this.dataCount)
  }

  /** Renders every row's wedge as a stack of annular-sector blocks (one path per target, one
   * `drawPath()` call per block, radially outward from `textRadius`) plus a centered text label
   * showing `calculateData()`'s formatted `total`. When there is no data (`dataCount == 0`), every
   * block is filled with the theme's background color instead of a target color, producing an
   * empty placeholder ring rather than nothing. Each target's path segment within a wedge gets its
   * own click/hover events via `addEvent(p, i, j)`. */
  draw = (): any => {
    const info = this.calculateData()
    const data = info.data
    const total = info.total

    const stackBorderColor = this.chart.theme('arcEqualizerBorderColor')
    const stackBorderWidth = this.chart.theme('arcEqualizerBorderWidth')
    const textFontSize = this.chart.theme('arcEqualizerFontSize') as number
    const textFontColor = this.chart.theme('arcEqualizerFontColor')
    const textRadius = (this.brush as Record<string, unknown>).textRadius as number

    for (let i = 0; i < data.length; i++) {
      let start = 0

      for (let j = 0; j < data[i].length; j++) {
        const p = this.svg.path({
          fill: this.dataCount == 0 ? this.chart.theme('arcEqualizerBackgroundColor') : this.color(j),
          stroke: stackBorderColor,
          'stroke-width': stackBorderWidth,
        })

        for (let k = start; k < start + data[i][j]; k++) {
          this.drawPath(p, textRadius + k * this.stackSize, i * this.stackAngle, (i + 1) * this.stackAngle)
        }

        start += data[i][j]

        this.addEvent(p, i, j)
        this.g.append(p)
      }
    }

    const text = this.chart
      .text({
        'font-size': textFontSize,
        'text-anchor': 'middle',
        fill: textFontColor,
        x: this.cx,
        y: this.cy,
        dy: textFontSize / 3,
      })
      .text(this.format(total) as string)
    this.g.append(text)

    return this.g
  }

  /** Returns this brush's own default options (`clip`/`maxValue`/`stackCount`/`textRadius`/
   * `format`), merged by `defineOptions()` on top of `CoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return ARC_EQUALIZER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('arcequalizer', ArcEqualizerBrush)
