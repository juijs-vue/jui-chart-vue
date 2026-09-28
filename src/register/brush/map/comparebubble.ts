// Port of legacy `src/brush/map/comparebubble.js` ("chart.brush.map.comparebubble", extend:
// "chart.brush.map.core") - draws exactly 2 overlapping value-scaled circles centered in the map
// area, with connector-line labels for the larger ("max") and centered text for the smaller
// ("min") value - a fixed 2-row comparison visualization, not per-row like the other map brushes.
import { registerBrush, MapCoreBrush, mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

const BORDER_WIDTH = 1.5
const MAX_OPACITY = 0.8
const MIN_OPACITY = 0.6
const LINE_ANGLE = 315
const TITLE_RATE = 0.6

/** `chart.brush.map.comparebubble`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface MapCompareBubbleBrushOptions {
  /** Radius in px of the larger ("max") circle; the smaller ("min") circle's radius is derived
   * proportionally from it (`size * (minValue / maxValue)`). Requires exactly 2 data rows - see
   * this file's own header comment. */
  size?: number
  /** Formats the value text shown in each circle's own label; the raw `value` is used verbatim
   * when omitted. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.map.comparebubble.setup()` fields - see legacy `map/comparebubble.js`. */
export const MAP_COMPAREBUBBLE_BRUSH_OWN_DEFAULTS: MapCompareBubbleBrushOptions = {
  size: 100,
  format: null,
}

/** Draws exactly 2 overlapping value-scaled circles centered in the map area, with a connector-line
 * callout label for the larger ("max") value and a centered label for the smaller ("min") one - a
 * fixed 2-row comparison visualization, not per-row like the other map brushes. Renders nothing
 * beyond an empty group unless `listData()` returns exactly 2 rows (per `drawBefore()`'s own
 * resolution of which row is "min" vs "max"). */
export class MapCompareBubbleBrush extends MapCoreBrush {
  private g: any
  private min: BrushData | null = null
  private max: BrushData | null = null
  private minValue = 0
  private maxValue = 0

  /** Builds a two-line text block - `value` on the first line (font-size `size`) and `title`
   * below it (font-size `size * TITLE_RATE`, offset `x: 0, y: size` relative to the first line) -
   * translated to `(x, y)`. Shared by `drawMaxText()`/`drawMinText()` for both circles' labels. */
  private getTextInBubble(color: unknown, align: string, size: unknown, title: unknown, value: unknown, x: number, y: number): any {
    return this.chart.svg
      .text(
        {
          fill: color,
          'text-anchor': align,
          y: 7,
        },
        () => {
          this.chart.svg.tspan({ 'font-size': size }, String(value))
          this.chart.svg.tspan({ 'font-size': (size as number) * TITLE_RATE, x: 0, y: size }, String(title))
        },
      )
      .translate(x, y)
  }

  /** Creates a fresh render group and, only when there are EXACTLY 2 data rows (per this file's
   * own header comment), resolves which one is the smaller ("min") and larger ("max") by comparing
   * their `value` fields (swapping the initial row0/row1 assignment if row0 turns out to be the
   * larger one) and caches both the rows and their resolved numeric values on `this`. With any
   * other row count, `min`/`max` are left `null` (their field-initializer default), which makes
   * `draw()` render nothing but the empty group. */
  drawBefore = (): void => {
    const data = this.listData() as BrushData[]
    this.g = this.chart.svg.group()

    if (data.length == 2) {
      this.min = data[0]
      this.max = data[1]
      this.minValue = this.axis.getValue(this.min, 'value') as number
      this.maxValue = this.axis.getValue(this.max, 'value') as number

      if (this.minValue > this.maxValue) {
        this.min = data[1]
        this.max = data[0]
        this.minValue = this.axis.getValue(this.min, 'value') as number
        this.maxValue = this.axis.getValue(this.max, 'value') as number
      }
    }
  }

  /** Draws the "max" bubble's callout: a dashed connector path from a small dot just outside
   * `(centerX, centerY)` (offset by one unit along `LINE_ANGLE`, 315°) diagonally out to distance
   * `gap * 2.5`, then horizontally out by `brush.size` more, ending at the label built by
   * `getTextInBubble()` (left-aligned, positioned 5px past the horizontal segment's end). `value`
   * is run through `brush.format` when it's a function. */
  drawMaxText(centerX: number, centerY: number, gap: number): any {
    const brush = this.brush as Record<string, unknown>
    const r = gap * 2.5
    const cx = centerX + Math.cos(mathUtil.radian(LINE_ANGLE))
    const cy = centerY + Math.sin(mathUtil.radian(LINE_ANGLE))
    const tx = centerX + Math.cos(mathUtil.radian(LINE_ANGLE)) * r
    const ty = centerY + Math.sin(mathUtil.radian(LINE_ANGLE)) * r
    const ex = tx + (brush.size as number)
    const title = this.axis.getValue(this.max as BrushData, 'title', '')
    let value: unknown = this.axis.getValue(this.max as BrushData, 'value', 0)
    const size = this.chart.theme('mapCompareBubbleMaxFontSize')

    if (typeof brush.format === 'function') {
      value = this.format(value)
    }

    const group = this.chart.svg.group({}, () => {
      const path = this.chart.svg.path({
        fill: 'transparent',
        stroke: this.chart.theme('mapCompareBubbleMaxLineColor'),
        'stroke-width': BORDER_WIDTH,
        'stroke-dasharray': this.chart.theme('mapCompareBubbleMaxLineDashArray'),
      })

      path.MoveTo(cx, cy).LineTo(tx, ty).LineTo(ex, ty)

      this.chart.svg.circle({
        cx,
        cy,
        r: 3,
        fill: this.chart.theme('mapCompareBubbleMaxLineColor'),
      })
    })

    group.append(this.getTextInBubble(this.chart.theme('mapCompareBubbleMaxFontColor'), 'start', size, title, value, ex + 5, ty))

    return group
  }

  /** Draws the "min" bubble's callout: a center-aligned label built by `getTextInBubble()`,
   * nudged up by half the title line's height (`size * TITLE_RATE / 2`) so the two-line block sits
   * visually centered on `(centerX, centerY)` rather than the (larger) value line alone. `value` is
   * run through `brush.format` when it's a function. */
  drawMinText(centerX: number, centerY: number): any {
    const brush = this.brush as Record<string, unknown>
    const title = this.axis.getValue(this.min as BrushData, 'title', '')
    let value: unknown = this.axis.getValue(this.min as BrushData, 'value', 0)
    const group = this.chart.svg.group()
    const size = this.chart.theme('mapCompareBubbleMinFontSize')

    if (typeof brush.format === 'function') {
      value = this.format(value)
    }

    group.append(this.getTextInBubble(this.chart.theme('mapCompareBubbleMinFontColor'), 'middle', size, title, value, centerX, centerY - ((size as number) * TITLE_RATE) / 2))

    return group
  }

  /** Renders the comparison: does nothing beyond returning the (possibly empty) group from
   * `drawBefore()` unless that pass resolved both `min` and `max`. The "max" circle is drawn at the
   * fixed `brush.size` radius, centered in the map area; the "min" circle's radius is
   * `maxSize * (minValue / maxValue)` (a plain value ratio - an all-zero or zero-`maxValue` dataset
   * would produce `NaN`/`Infinity`, not specially guarded here), drawn `gap = maxSize - minSize`
   * pixels below center so the two circles overlap with their bottoms roughly level. Appends
   * `drawMaxText()`'s callout above the overlap and `drawMinText()`'s centered label over the min
   * circle. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>

    if (this.min != null && this.max != null) {
      const maxSize = brush.size as number
      const minSize = maxSize * (this.minValue / this.maxValue)
      const gap = maxSize - minSize
      const cx = this.axis.area('width') / 2
      const cy = this.axis.area('height') / 2

      const c1 = this.chart.svg.circle({
        r: maxSize,
        fill: this.color(0),
        'fill-opacity': MAX_OPACITY,
        stroke: this.chart.theme('mapCompareBubbleMaxBorderColor'),
        'stroke-width': BORDER_WIDTH,
        cx,
        cy,
      })

      const c2 = this.chart.svg.circle({
        r: minSize,
        fill: this.color(1),
        'fill-opacity': MIN_OPACITY,
        stroke: this.chart.theme('mapCompareBubbleMinBorderColor'),
        'stroke-width': BORDER_WIDTH,
        cx,
        cy: cy + gap - BORDER_WIDTH,
      })

      this.g.append(c1)
      this.g.append(c2)
      this.g.append(this.drawMaxText(cx, cy - minSize, gap))
      this.g.append(this.drawMinText(cx, cy + gap - BORDER_WIDTH))
    }

    return this.g
  }

  /** Returns this brush's own default options (`size`/`format`), merged by `defineOptions()` on
   * top of `MapCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return MAP_COMPAREBUBBLE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('map.comparebubble', MapCompareBubbleBrush)
