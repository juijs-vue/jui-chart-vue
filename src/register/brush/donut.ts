// Port of legacy `src/brush/donut.js` ("chart.brush.donut", extend: "chart.brush.pie") - extends
// `PieBrush` (confirmed from the legacy file's own `extend:` field) via real TS class inheritance.
// `draw()`/`drawBefore()` are INHERITED UNCHANGED from `PieBrush` (donut.js defines neither) - they
// call `this.drawUnit(...)`/`this.drawNoData(...)`/`this.getProperty(...)` which correctly
// dynamically dispatch to this class's own overrides below, exactly like real OOP. Only
// `getFormatText`/`drawPie`/`setActiveEvent`/`setActiveTextEvent`/`drawText`/`color`/`addEvent`
// are reused unmodified from `PieBrush`; `drawUnit`/`drawNoData`/`getProperty` are overridden, and
// `drawDonut`/`drawDonut3d`/`drawDonut3dBlock`/`drawTotalValue` are new methods this file adds.
//
// Legacy's `drawDonut3d(...)`/`drawDonut3dBlock(...)` call sites pass an extra trailing boolean
// argument (`i == target.length - 1`) that neither function's own declared parameter list (7
// params) ever reads - confirmed dead by reading both functions in full. Omitted here (TypeScript
// would reject an extra call argument beyond the declared parameter count; dropping a
// provably-never-read trailing argument changes nothing observable).
import { registerBrush } from 'jui-graph-ts'
import { mathUtil, colorUtil } from 'jui-graph-ts'
import { PieBrush } from './pie'
import type { PieBrushOptions } from './pie'

/** `chart.brush.donut`'s own config fields (on top of the inherited `PieBrushOptions`). */
export interface DonutBrushOptions extends PieBrushOptions {
  /** Ring thickness in px (`outerRadius - innerRadius`) - also auto-shrunk by `getProperty()` if
   * it would exceed half the available plot area. */
  size?: number
  /** Shows the sum of all slice values as text in the donut's center hole. */
  showValue?: boolean
}

/** Own `chart.brush.donut.setup()` fields - see legacy `donut.js`. */
export const DONUT_BRUSH_OWN_DEFAULTS: DonutBrushOptions = {
  size: 50,
  showValue: false,
}

export class DonutBrush extends PieBrush {
  // Own instance state, unrelated to `PieBrush`'s own private `cache_active` field (each class's
  // own `drawUnit` override populates/reads only its own) - renamed to avoid a TS2415 "separate
  // declarations of a private property" error a same-named private field would trigger across the
  // `extends` boundary (pure internal naming, zero behavior change - same precedent as Batch 1's
  // `StackBarBrush.stackGroupList` rename).
  private donutCacheActive: Record<string, any> = {}

  drawDonut(centerX: number, centerY: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, attr: Record<string, unknown>): any {
    attr['stroke-width'] = outerRadius - innerRadius

    if (endAngle >= 360) {
      // bugfix : if angle is 360 , donut cang't show
      endAngle = 359.9999
    }

    const g = this.chart.svg.group()
    const path = this.chart.svg.path(attr)

    let obj = mathUtil.rotate(0, -outerRadius, mathUtil.radian(startAngle))
    const startX = obj.x
    const startY = obj.y

    path.MoveTo(startX, startY)

    obj = mathUtil.rotate(startX, startY, mathUtil.radian(endAngle))

    g.translate(centerX, centerY)

    path.Arc(outerRadius, outerRadius, 0, endAngle > 180 ? 1 : 0, 1, obj.x, obj.y)

    path.css({ 'pointer-events': 'stroke' })

    g.append(path)
    g.order = 1

    return g
  }

  drawDonut3d(centerX: number, centerY: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, attr: Record<string, unknown>): any {
    const g = this.chart.svg.group()
    const path = this.chart.svg.path(attr)
    const dist = Math.abs(outerRadius - innerRadius)

    outerRadius += dist / 2
    innerRadius = outerRadius - dist

    let obj = mathUtil.rotate(0, -outerRadius, mathUtil.radian(startAngle))
    const startX = obj.x
    const startY = obj.y

    let innerObj = mathUtil.rotate(0, -innerRadius, mathUtil.radian(startAngle))
    const innerStartX = innerObj.x
    const innerStartY = innerObj.y

    path.MoveTo(startX, startY)

    obj = mathUtil.rotate(startX, startY, mathUtil.radian(endAngle))
    innerObj = mathUtil.rotate(innerStartX, innerStartY, mathUtil.radian(endAngle))

    g.translate(centerX, centerY)

    path.Arc(outerRadius, outerRadius, 0, endAngle > 180 ? 1 : 0, 1, obj.x, obj.y)

    const y = obj.y + 10
    const x = obj.x + 5
    const innerY = innerObj.y + 10
    const innerX = innerObj.x + 5
    const targetX = startX + 5
    const targetY = startY + 10
    const innerTargetX = innerStartX + 5
    const innerTargetY = innerStartY + 10

    path.LineTo(x, y)
    path.Arc(outerRadius, outerRadius, 0, endAngle > 180 ? 1 : 0, 0, targetX, targetY)
    path.ClosePath()
    g.append(path)

    const innerPath = this.chart.svg.path(attr)

    innerPath.MoveTo(innerStartX, innerStartY)
    innerPath.Arc(innerRadius, innerRadius, 0, endAngle > 180 ? 1 : 0, 1, innerObj.x, innerObj.y)
    innerPath.LineTo(innerX, innerY)
    innerPath.Arc(innerRadius, innerRadius, 0, endAngle > 180 ? 1 : 0, 0, innerTargetX, innerTargetY)
    innerPath.ClosePath()

    g.append(innerPath)
    g.order = 1

    return g
  }

  drawDonut3dBlock(centerX: number, centerY: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, attr: Record<string, unknown>): any {
    const g = this.chart.svg.group()
    const path = this.chart.svg.path(attr)
    const dist = Math.abs(outerRadius - innerRadius)

    outerRadius += dist / 2
    innerRadius = outerRadius - dist

    let obj = mathUtil.rotate(0, -outerRadius, mathUtil.radian(startAngle))
    const startX = obj.x
    const startY = obj.y

    let innerObj = mathUtil.rotate(0, -innerRadius, mathUtil.radian(startAngle))
    const innerStartX = innerObj.x
    const innerStartY = innerObj.y

    path.MoveTo(startX, startY)

    obj = mathUtil.rotate(startX, startY, mathUtil.radian(endAngle))
    innerObj = mathUtil.rotate(innerStartX, innerStartY, mathUtil.radian(endAngle))

    g.translate(centerX, centerY)

    const y = obj.y + 10
    const x = obj.x + 5
    const innerY = innerObj.y + 10
    const innerX = innerObj.x + 5

    const rect = this.chart.svg.path(attr)
    rect.MoveTo(obj.x, obj.y).LineTo(x, y).LineTo(innerX, innerY).LineTo(innerObj.x, innerObj.y).ClosePath()

    g.append(rect)
    g.order = 1

    return g
  }

  drawUnit(index: number, data: Record<string, unknown>, g: any): void {
    const props = this.getProperty(index)
    const { centerX, centerY, innerRadius, outerRadius } = props

    const target = this.brush.target ?? []
    const active = (this.brush as Record<string, unknown>).active as string | string[] | null
    const all = 360
    let startAngle = 0
    let max = 0
    let totalValue = 0

    for (let i = 0; i < target.length; i++) {
      max += data[target[i]] as number
    }

    if ((this.brush as Record<string, unknown>)['3d']) {
      for (let i = 0; i < target.length; i++) {
        const value = data[target[i]] as number
        const endAngle = all * (value / max)
        const donut3d = this.drawDonut3dBlock(centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, {
          fill: colorUtil.darken(this.color(i) as string, 0.5),
        })
        g.append(donut3d)

        startAngle += endAngle
      }

      startAngle = 0
      for (let i = 0; i < target.length; i++) {
        const value = data[target[i]] as number
        const endAngle = all * (value / max)
        const donut3d = this.drawDonut3d(centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, {
          fill: colorUtil.darken(this.color(i) as string, 0.5),
        })
        g.append(donut3d)

        startAngle += endAngle
      }
    }

    startAngle = 0

    for (let i = 0; i < target.length; i++) {
      if (data[target[i]] == 0) continue

      const value = data[target[i]] as number
      const endAngle = all * (value / max)
      const centerAngle = startAngle + endAngle / 2 - 90
      const isOnlyOne = Math.abs(startAngle - endAngle) == 360
      const brushSize = (this.brush as Record<string, unknown>).size as number
      const radius = (this.brush as Record<string, unknown>).showText == 'inside' ? brushSize + innerRadius + outerRadius : outerRadius
      const donut = this.drawDonut(centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, {
        stroke: this.color(i),
        fill: 'transparent',
      })
      const text = this.drawText(centerX, centerY, centerAngle, radius as number, this.getFormatText(target[i], value))

      this.donutCacheActive[centerAngle] = {
        active: false,
        pie: donut,
        text,
        centerX,
        centerY,
        centerAngle,
        outerRadius: radius,
      }

      if (!isOnlyOne) {
        if (active === target[i] || (Array.isArray(active) && active.includes(target[i]))) {
          this.donutCacheActive[centerAngle].active = true
        } else {
          this.donutCacheActive[centerAngle].active = false
        }

        if ((this.brush as Record<string, unknown>).showText === 'inside') {
          this.setActiveTextEvent(this.donutCacheActive)
        }

        this.setActiveEvent(this.donutCacheActive, false)

        if ((this.brush as Record<string, unknown>).activeEvent != null) {
          const p = donut
          const ca = centerAngle

          p.on((this.brush as Record<string, unknown>).activeEvent, () => {
            this.donutCacheActive[ca].active = !this.donutCacheActive[ca].active

            if ((this.brush as Record<string, unknown>).showText === 'inside') {
              this.setActiveTextEvent(this.donutCacheActive)
            }

            this.setActiveEvent(this.donutCacheActive, false)
          })

          p.attr({ cursor: 'pointer' })
        }
      }

      this.addEvent(donut, index, i)
      g.append(donut)
      g.append(text)

      startAngle += endAngle
      totalValue += value
    }

    if ((this.brush as Record<string, unknown>).showValue) {
      this.drawTotalValue(g, centerX, centerY, totalValue)
    }
  }

  drawNoData(g: any): void {
    const props = this.getProperty(0)

    g.append(
      this.drawDonut(props.centerX, props.centerY, props.innerRadius, props.outerRadius, 0, 360, {
        stroke: this.chart.theme('pieNoDataBackgroundColor'),
        fill: 'transparent',
      }),
    )

    if ((this.brush as Record<string, unknown>).showValue) {
      this.drawTotalValue(g, props.centerX, props.centerY, 0)
    }
  }

  drawTotalValue(g: any, centerX: number, centerY: number, value: number): void {
    const size = this.chart.theme('pieTotalValueFontSize') as number

    const text = this.chart.text(
      {
        'font-size': size,
        'font-weight': this.chart.theme('pieTotalValueFontWeight'),
        fill: this.chart.theme('pieTotalValueFontColor'),
        'text-anchor': 'middle',
        dy: size / 3,
      },
      this.format(value) as string,
    )

    text.translate(centerX, centerY)
    g.append(text)
  }

  getProperty(index: number): { centerX: number; centerY: number; outerRadius: number; innerRadius: number } {
    const obj = (this.axis.c as unknown as (i: number) => { width: number; height: number; x: number; y: number })(index)

    const width = obj.width
    const height = obj.height
    const x = obj.x
    const y = obj.y
    let min = width

    if (height < min) {
      min = height
    }

    const brush = this.brush as Record<string, unknown>
    if ((brush.size as number) >= min / 2) {
      brush.size = min / 4
    }

    const outerRadius = min / 2 - (brush.size as number) / 2

    return {
      centerX: width / 2 + x,
      centerY: height / 2 + y,
      outerRadius,
      innerRadius: outerRadius - (brush.size as number),
    }
  }

  static setup(): Record<string, unknown> {
    return DONUT_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('donut', DonutBrush)
