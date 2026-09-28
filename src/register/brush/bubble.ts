// Port of legacy `src/brush/bubble.js` ("chart.brush.bubble", extend: "chart.brush.core") -
// extends `CoreBrush` directly (NOT `ScatterBrush` - a fully separate implementation despite the
// visual similarity, confirmed from source and cross-checked against `main` branch's
// `useBubble.ts` header comment, which independently confirmed the same finding). Shares the same
// `getXY()` axis-based (x,y) positioning as every other axis brush; adds a 3rd, radius-encoded
// dimension on top via `mathUtil.scaleValue()` (verified byte-identical to the legacy
// `util.math.scaleValue()` this ports - both delegate to the same underlying `jui-core-ts`
// function per `jui-graph-ts`'s own `util/math.ts` reconciliation note).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import { mathUtil } from 'jui-graph-ts'
import type { BrushData, BrushSeriesXY } from 'jui-graph-ts'

/** `chart.brush.bubble`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface BubbleBrushOptions {
  /** Minimum rendered bubble radius in px, mapped to the data's smallest scale value. */
  min?: number
  /** Maximum rendered bubble radius in px, mapped to the data's largest scale value. */
  max?: number
  /** Data key whose value drives each bubble's radius (via `mathUtil.scaleValue()` between
   * `min`/`max`); `null` uses the same value driving the bubble's y-position instead. */
  scaleKey?: string | null
  /** Shows each bubble's value as text centered on it. */
  showText?: boolean
  /** Formats the value shown in text/tooltips; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
  /** Index of the bubble to show a permanent (always-visible) value tooltip for, on mount. */
  active?: number | null
  /** DOM event name (e.g. `'click'`) that toggles a bubble's value tooltip on/off; `null`
   * disables this per-bubble toggle interaction. */
  activeEvent?: string | null
}

/** Own `chart.brush.bubble.setup()` fields - see legacy `bubble.js`. */
export const BUBBLE_BRUSH_OWN_DEFAULTS: BubbleBrushOptions = {
  min: 5,
  max: 30,
  scaleKey: null,
  showText: false,
  format: null,
  active: null,
  activeEvent: null,
}

export class BubbleBrush extends CoreBrush {
  protected bubbleList: any[] = []

  private bubbleMin: number | null = null
  private bubbleMax: number | null = null

  getFormatText(value: unknown, dataIndex: number): unknown {
    if (typeof (this.brush as Record<string, unknown>).format === 'function') {
      return this.format(this.axis.data[dataIndex])
    }

    return value
  }

  getBubbleRadius(value: number, dataIndex: number): number {
    const scaleKey = (this.brush as Record<string, unknown>).scaleKey as string | null

    if (scaleKey != null) {
      const scaleValue = (this.axis.data[dataIndex] as BrushData)[scaleKey]
      value = typeof scaleValue === 'number' ? scaleValue : value
    }

    return mathUtil.scaleValue(value, this.bubbleMin as number, this.bubbleMax as number, (this.brush as Record<string, unknown>).min as number, (this.brush as Record<string, unknown>).max as number)
  }

  createBubble(pos: { x: number; y: number; value: unknown }, color: string, dataIndex: number): any {
    const radius = this.getBubbleRadius(pos.value as number, dataIndex)
    const circle = this.svg.group().translate(pos.x, pos.y)

    circle.append(
      this.svg.circle({
        r: radius,
        fill: color,
        'fill-opacity': this.chart.theme('bubbleBackgroundOpacity'),
        stroke: color,
        'stroke-width': this.chart.theme('bubbleBorderWidth'),
      }),
    )

    if ((this.brush as Record<string, unknown>).showText) {
      const text = this.getFormatText(pos.value, dataIndex)

      circle.append(
        this.chart
          .text({
            'font-size': this.chart.theme('bubbleFontSize'),
            fill: this.chart.theme('bubbleFontColor'),
            'text-anchor': 'middle',
            dy: 3,
          })
          .text(text as string),
      )
    }

    this.bubbleList.push(circle)

    return circle
  }

  setActiveEffect(r: any): void {
    const cols = this.bubbleList

    for (let i = 0; i < cols.length; i++) {
      const opacity = cols[i] == r ? 1 : this.chart.theme('bubbleBackgroundOpacity')

      cols[i].get(0).attr({ opacity })
      // PRESERVED BUG, not silently avoided with `?.` here: legacy calls `.get(1).attr(...)`
      // UNCONDITIONALLY, even though `createBubble()` only ever appends a second (text) child
      // when `brush.showText` is true (the default is `false`). With `showText: false` (the
      // default!), `.get(1)` returns `null` (per `Element.get()`'s own real "child doesn't exist"
      // return value), and calling `.attr(...)` on it throws `TypeError: Cannot read properties
      // of null` - a REAL crash in the true original engine too, reachable whenever a default
      // (`showText: false`) bubble chart also configures `active` or `activeEvent` (both of which
      // call this method). Flagged in this task's final report rather than silently patched with
      // optional chaining, per the same "don't silently fix a faithfully-reachable original bug"
      // instruction already applied to `BarBrush`/`ColumnBrush`'s `drawAnimate()`.
      cols[i].get(1).attr({ opacity })
    }
  }

  drawBubble(points: BrushSeriesXY[]): any {
    const g = this.svg.group()

    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points[i].x.length; j++) {
        const b = this.createBubble({ x: points[i].x[j], y: points[i].y[j], value: points[i].value[j] }, this.color(j, i), j)

        if ((this.brush as Record<string, unknown>).activeEvent != null) {
          const bubble = b
          bubble.on((this.brush as Record<string, unknown>).activeEvent, () => {
            this.setActiveEffect(bubble)
          })

          bubble.attr({ cursor: 'pointer' })
        }

        this.addEvent(b, j, i)
        g.append(b)
      }
    }

    const active = (this.brush as Record<string, unknown>).active as number | null
    const bubble = active != null ? this.bubbleList[active] : undefined
    if (bubble != null) {
      this.setActiveEffect(bubble)
    }

    return g
  }

  drawBefore = (): void => {
    const scaleKey = (this.brush as Record<string, unknown>).scaleKey as string | null

    if (scaleKey != null) {
      const values: number[] = []

      for (let i = 0; i < this.axis.data.length; i++) {
        values.push((this.axis.data[i] as BrushData)[scaleKey] as number)
      }

      this.bubbleMin = Math.min.apply(this, values)
      this.bubbleMax = Math.max.apply(this, values)
    } else {
      this.bubbleMin = (this.axis.y as unknown as { min(): number }).min()
      this.bubbleMax = (this.axis.y as unknown as { max(): number }).max()
    }

    this.bubbleList = []
  }

  draw = (): any => {
    return this.drawBubble(this.getXY())
  }

  drawAnimate = (root: any): void => {
    root.each((_i: number, elem: any) => {
      const c = elem.children[0]

      c.append(
        this.svg.animateTransform({
          attributeType: 'xml',
          attributeName: 'transform',
          type: 'scale',
          from: '0',
          to: '1',
          dur: '0.7s',
          fill: 'freeze',
          repeatCount: '1',
        }),
      )

      c.append(
        this.svg.animate({
          attributeType: 'xml',
          attributeName: 'fill-opacity',
          from: '0',
          to: this.chart.theme('bubbleBackgroundOpacity'),
          dur: '1.4s',
          repeatCount: '1',
          fill: 'freeze',
        }),
      )
    })
  }

  static setup(): Record<string, unknown> {
    return BUBBLE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('bubble', BubbleBrush)
