// Port of legacy `src/brush/arcgauge.js` ("chart.brush.arcgauge", extend: "chart.brush.fullgauge")
// - extends `FullGaugeBrush` (confirmed from the legacy file's own `extend:` field), reusing its
// inherited `createText()`/`createTitle()` (both public, unchanged) but completely overriding
// `draw()`/adding its own `drawUnit()`/`calculateArea()`/`polarToCartesian()`/`describeArc()`/
// `drawStroke()` - a tick-marked circular arc gauge (dotted radial ticks + one filled arc "stack"
// segment), positioned via `axis.c(0)` -> `{width,height}` (a DIFFERENT call shape than
// `FullGaugeBrush`'s own per-row `axis.c(i)` - here always row `0`, resolved once per `drawUnit`
// call since the whole gauge area is shared across all rows).
import { registerBrush, mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { FullGaugeBrush } from './fullgauge'
import type { FullGaugeBrushOptions } from './fullgauge'

type CAxis = (i: number) => { width: number; height: number }

interface ArcArea {
  radius: number
  width: number
  centerX: number
  centerY: number
}

/** `chart.brush.arcgauge`'s own config fields (on top of the inherited `FullGaugeBrushOptions` -
 * `startAngle`/`endAngle`/`size` are redeclared here with different defaults/meaning: a tick-marked
 * radial arc rather than a full ring). */
export interface ArcGaugeBrushOptions extends Omit<FullGaugeBrushOptions, 'startAngle' | 'endAngle' | 'size'> {
  /** Stroke width of the filled value arc in px. */
  size?: number
  /** Start angle in degrees of the tick-marked arc. */
  startAngle?: number
  /** End angle in degrees of the tick-marked arc (an angular span from `startAngle`). */
  endAngle?: number
  /** X offset in px for the title label. */
  titleX?: number
  /** Y offset in px for the title label. */
  titleY?: number
  /** Formats the value shown in the center label; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.arcgauge.setup()` fields - see legacy `arcgauge.js`. */
export const ARCGAUGE_BRUSH_OWN_DEFAULTS: ArcGaugeBrushOptions = {
  size: 5,
  startAngle: 245,
  endAngle: 475,
  showText: true,
  titleX: 0,
  titleY: 0,
  format: null,
}

export class ArcGaugeBrush extends FullGaugeBrush {
  private arcG: any

  private calculateArea(): ArcArea {
    const area = (this.axis.c as unknown as CAxis)(0)
    const dist = Math.abs(area.width - area.height)
    const r = Math.min(area.width, area.height) / 2

    return {
      radius: r - ((this.brush as Record<string, unknown>).size as number),
      width: (this.brush as Record<string, unknown>).size as number,
      centerX: r + (area.width > area.height ? dist / 2 : 0),
      centerY: r + (area.width < area.height ? dist / 2 : 0),
    }
  }

  private polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number): { x: number; y: number } {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0

    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    }
  }

  private describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number): { sx: number; sy: number; ex: number; ey: number; sweep: boolean } {
    const endAngleOriginal = endAngle

    if (endAngleOriginal - startAngle === 360) {
      endAngle = 359.9
    }

    const start = this.polarToCartesian(centerX, centerY, radius, endAngle)
    const end = this.polarToCartesian(centerX, centerY, radius, startAngle)
    const arcSweep = endAngle - startAngle <= 180 ? false : true

    return { sx: end.x, sy: end.y, ex: start.x, ey: start.y, sweep: arcSweep }
  }

  private drawStroke(p: any, radius: number, width: number, startAngle: number, endAngle: number): void {
    const area = this.calculateArea()
    const arc1 = this.describeArc(area.centerX, area.centerY, radius, startAngle, endAngle)
    const arc2 = this.describeArc(area.centerX, area.centerY, radius + width, startAngle, endAngle)

    p.MoveTo(arc1.sx, arc1.sy)
    p.Arc(radius, radius, 0, arc1.sweep, 1, arc1.ex, arc1.ey)
    p.LineTo(arc2.ex, arc2.ey)
    p.Arc(radius + width, radius + width, 0, arc2.sweep, 0, arc2.sx, arc2.sy)
    p.LineTo(arc1.sx, arc1.sy)
    p.ClosePath()
  }

  // Public (not `private`), matching the inherited `FullGaugeBrush.drawUnit(index, data)`'s own
  // visibility/signature exactly - a `private` override here would be a TS2415 error (narrower
  // visibility than the base class member), same category `donut.ts`/`pie.ts` already document
  // for this exact method name across the gauge/pie family.
  drawUnit(index: number, data: unknown): void {
    const row = data as BrushData
    const brush = this.brush as Record<string, unknown>
    const startAngle = brush.startAngle as number
    const endAngle = brush.endAngle as number

    const title = this.getValue(row, 'title')
    const value = this.getValue(row, 'value', 0) as number
    const max = this.getValue(row, 'max', 100) as number
    const min = this.getValue(row, 'min', 0) as number
    const rate = (value - min) / (max - min)
    const currentAngle = (endAngle - startAngle) * rate

    const area = this.calculateArea()
    const textScale = mathUtil.scaleValue(area.radius, 40, 400, 1, 1.5)
    const stackSize = brush.size as number

    for (let i = startAngle; i < endAngle; i += 5) {
      const rad = mathUtil.radian(i - 89)
      const sx = Math.cos(rad) * (area.radius - stackSize)
      const sy = Math.sin(rad) * (area.radius - stackSize)
      const ex = Math.cos(rad) * (area.radius - stackSize * 3)
      const ey = Math.sin(rad) * (area.radius - stackSize * 3)

      this.arcG.append(
        this.svg.line({
          x1: area.centerX + sx,
          y1: area.centerY + sy,
          x2: area.centerX + ex,
          y2: area.centerY + ey,
          stroke: this.chart.theme('gaugeArrowColor'),
        }),
      )
    }

    const stack = this.svg.path({ fill: this.color(index) })

    this.drawStroke(stack, area.radius, area.width, startAngle, startAngle + currentAngle)
    this.arcG.append(stack)

    if (brush.showText) {
      this.arcG.append(this.createText(value, index, area.centerX, area.centerY - area.radius * 0.2, textScale))
    }

    if (title != '') {
      this.arcG.append(this.createTitle(title, index, area.centerX, area.centerY - area.radius * 0.2, brush.titleX as number, brush.titleY as number, textScale))
    }
  }

  draw = (): any => {
    this.arcG = this.chart.svg.group()

    this.eachData((data, i) => {
      this.drawUnit(i as number, data as BrushData)
    })

    return this.arcG
  }

  static setup(): Record<string, unknown> {
    return ARCGAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('arcgauge', ArcGaugeBrush)
