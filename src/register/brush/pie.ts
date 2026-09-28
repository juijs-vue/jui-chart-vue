// Port of legacy `src/brush/pie.js` ("chart.brush.pie", extend: "chart.brush.core"). Uses the
// axis's "c" (custom/panel) grid slot for its plot rect (`this.axis.c(index)`) - `base/axis.ts`'s
// `drawGridType()` always draws a `"panel"`-type "c" grid by default (even with no `axis.c` config
// at all - the `k === "c"` branch skips the `!typeCheck("object", axis[k])` early-return every
// other slot has), so no extra axis config is required for a pie chart beyond `axis: [{ data }]`.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import { mathUtil, colorUtil } from 'jui-graph-ts'

interface PieCacheEntry {
  active: boolean
  pie: any
  text: any
  centerX: number
  centerY: number
  centerAngle: number
  outerRadius: number
}

/** `chart.brush.pie`'s own config fields. `clip` defaults to `false` here (unlike
 * `CoreBrush`'s own `clip: true` default) - `jui-graph-ts`'s `defineOptions()` merges leaf-first
 * (`PieBrush.setup()` before `CoreBrush.setup()`), so this leaf-level `clip: false` correctly
 * wins over `CoreBrush`'s own default without any extra work here. */
export interface PieBrushOptions {
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `pie.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** Shows each slice's value/label text either inside the slice or just outside its edge;
   * `null` shows no text. */
  showText?: 'inside' | 'outside' | null
  /** Formats the value shown in a slice's text/tooltip; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
  /** Renders a pseudo-3D (extruded/beveled) slice style instead of a flat 2D one. */
  '3d'?: boolean
  /** Which slice(s) render at full opacity/expanded by default - a target key, an array of keys,
   * or `null` for none highlighted initially. */
  active?: string | string[] | null
  /** DOM event name (e.g. `'click'`) that toggles a slice's active/highlighted state when it
   * fires on that slice; `null` disables this per-slice toggle interaction. */
  activeEvent?: string | null
}

/** Own `chart.brush.pie.setup()` fields - see legacy `pie.js`. Note `clip` defaults to `false`
 * here (unlike `CoreBrush`'s own `clip: true` default) - `jui-graph-ts`'s `defineOptions()` merges
 * leaf-first (`PieBrush.setup()` before `CoreBrush.setup()`), so this leaf-level `clip: false`
 * correctly wins over `CoreBrush`'s own default without any extra work here. */
export const PIE_BRUSH_OWN_DEFAULTS: PieBrushOptions = {
  clip: false,
  showText: null,
  format: null,
  '3d': false,
  active: null,
  activeEvent: null,
}

export class PieBrush extends CoreBrush {
  private textY = 3
  private preAngle = 0
  private preRate = 0
  private preOpacity = 1
  private g: any
  private cache_active: Record<string, PieCacheEntry> = {}

  setActiveEvent(items: Record<string, PieCacheEntry>, useOpacity?: boolean): void {
    let isDisableAll = true
    const disabledOpacity = (this.chart.theme('pieDisableBackgroundOpacity') as number) || 0.5

    for (const key in items) {
      if (items[key].active) {
        isDisableAll = false
        break
      }
    }

    for (const key in items) {
      const data = items[key]

      if (data.active) {
        const dist = this.chart.theme('pieActiveDistance') as number
        const tx = Math.cos(mathUtil.radian(data.centerAngle)) * dist
        const ty = Math.sin(mathUtil.radian(data.centerAngle)) * dist

        data.pie.translate(data.centerX + tx, data.centerY + ty)
      } else {
        data.pie.translate(data.centerX, data.centerY)
      }

      if (useOpacity) {
        if (data.pie.children.length > 0) {
          data.pie.get(0).attr({ opacity: isDisableAll || data.active ? 1 : disabledOpacity })
        }

        if (data.text.children.length > 0) {
          data.text.get(0).attr({ opacity: isDisableAll || data.active ? 1 : disabledOpacity })
        }
      }
    }
  }

  setActiveTextEvent(items: Record<string, PieCacheEntry>): void {
    for (const key in items) {
      const data = items[key]
      const dist = data.active ? (this.chart.theme('pieActiveDistance') as number) : 0
      const cx = data.centerX + Math.cos(mathUtil.radian(data.centerAngle)) * ((data.outerRadius + dist) / 2)
      const cy = data.centerY + Math.sin(mathUtil.radian(data.centerAngle)) * ((data.outerRadius + dist) / 2)

      if (data.text.children.length > 0) {
        data.text.get(0).translate(cx, cy)
      }
    }
  }

  // `max` is optional (widened from Phase 1's original required param, a pure type-only change -
  // `donut.js`'s own `drawUnit()` calls `this.getFormatText(target[i], value)` with only 2 args,
  // letting `max` come through as `undefined`, exactly like this signature already behaved before
  // this widening; only the TS call-site ergonomics changed, not runtime behavior).
  getFormatText(target: string, value: unknown, max?: number): string {
    if (typeof (this.brush as Record<string, unknown>).format === 'function') {
      return this.format(target, value, max) as string
    } else {
      if (!value) {
        return target
      }

      return target + ': ' + this.format(value)
    }
  }

  drawPie(centerX: number, centerY: number, outerRadius: number, startAngle: number, endAngle: number, color: unknown): any {
    const pie = this.chart.svg.group()

    if (endAngle == 360) {
      const circle = this.chart.svg.circle({
        cx: centerX,
        cy: centerY,
        r: outerRadius,
        fill: color,
        stroke: this.chart.theme('pieBorderColor') || color,
        'stroke-width': this.chart.theme('pieBorderWidth'),
      })

      pie.append(circle)

      return pie
    }

    const path = this.chart.svg.path({
      fill: color,
      stroke: this.chart.theme('pieBorderColor') || color,
      'stroke-width': this.chart.theme('pieBorderWidth'),
    })

    let obj = mathUtil.rotate(0, -outerRadius, mathUtil.radian(startAngle))
    const startX = obj.x
    const startY = obj.y

    path.MoveTo(startX, startY)

    obj = mathUtil.rotate(startX, startY, mathUtil.radian(endAngle))

    pie.translate(centerX, centerY)

    path.Arc(outerRadius, outerRadius, 0, endAngle > 180 ? 1 : 0, 1, obj.x, obj.y).LineTo(0, 0).ClosePath()

    pie.append(path)
    pie.order = 1

    return pie
  }

  drawPie3d(centerX: number, centerY: number, outerRadius: number, startAngle: number, endAngle: number, color: unknown): any {
    const pie = this.chart.svg.group()
    const path = this.chart.svg.path({
      fill: color,
      stroke: this.chart.theme('pieBorderColor') || color,
      'stroke-width': this.chart.theme('pieBorderWidth'),
    })

    let obj = mathUtil.rotate(0, -outerRadius, mathUtil.radian(startAngle))
    const startX = obj.x
    const startY = obj.y

    path.MoveTo(startX, startY)

    obj = mathUtil.rotate(startX, startY, mathUtil.radian(endAngle))

    pie.translate(centerX, centerY)

    path.Arc(outerRadius, outerRadius, 0, endAngle > 180 ? 1 : 0, 1, obj.x, obj.y)

    const y = obj.y + 10
    const x = obj.x + 5
    const targetX = startX + 5
    const targetY = startY + 10

    path.LineTo(x, y)
    path.Arc(outerRadius, outerRadius, 0, endAngle > 180 ? 1 : 0, 0, targetX, targetY)
    path.ClosePath()

    pie.append(path)
    pie.order = 1

    return pie
  }

  drawText(centerX: number, centerY: number, centerAngle: number, outerRadius: number, text: string): any {
    const g = this.svg.group({
      visibility: !(this.brush as Record<string, unknown>).showText ? 'hidden' : 'visible',
    })
    const isLeft = centerAngle + 90 > 180

    if (text === '' || !text) {
      return g
    }

    if ((this.brush as Record<string, unknown>).showText === 'inside') {
      const cx = centerX + Math.cos(mathUtil.radian(centerAngle)) * (outerRadius / 2)
      const cy = centerY + Math.sin(mathUtil.radian(centerAngle)) * (outerRadius / 2)

      const textElem = this.chart.text(
        {
          'font-size': this.chart.theme('pieInnerFontSize'),
          fill: this.chart.theme('pieInnerFontColor'),
          'text-anchor': 'middle',
          y: this.textY,
        },
        text,
      )

      textElem.translate(cx, cy)

      g.append(textElem)
      g.order = 2
    } else {
      const rate = this.chart.theme('pieOuterLineRate') as number
      const diffAngle = Math.abs(centerAngle - this.preAngle)

      if (diffAngle < 2) {
        if (this.preRate == 0) {
          this.preRate = rate
        }

        const tick = rate * 0.05
        this.preRate -= tick
        this.preOpacity -= 0.25
      } else {
        this.preRate = rate
        this.preOpacity = 1
      }

      if (this.preRate > 1.2) {
        const dist = this.chart.theme('pieOuterLineSize') as number
        const r = outerRadius * this.preRate
        const cx = centerX + Math.cos(mathUtil.radian(centerAngle)) * outerRadius
        const cy = centerY + Math.sin(mathUtil.radian(centerAngle)) * outerRadius
        const tx = centerX + Math.cos(mathUtil.radian(centerAngle)) * r
        const ty = centerY + Math.sin(mathUtil.radian(centerAngle)) * r
        const ex = isLeft ? tx - dist : tx + dist

        const path = this.svg.path({
          fill: 'transparent',
          stroke: this.chart.theme('pieOuterLineColor'),
          'stroke-width': this.chart.theme('pieOuterLineWidth'),
          'stroke-opacity': this.preOpacity,
        })

        path.MoveTo(cx, cy).LineTo(tx, ty).LineTo(ex, ty)

        const textElem = this.chart.text(
          {
            'font-size': this.chart.theme('pieOuterFontSize'),
            fill: this.chart.theme('pieOuterFontColor'),
            'fill-opacity': this.preOpacity,
            'text-anchor': isLeft ? 'end' : 'start',
            y: this.textY,
          },
          text,
        )

        textElem.translate(ex + (isLeft ? -3 : 3), ty)

        g.append(textElem)
        g.append(path)
        g.order = 0

        this.preAngle = centerAngle
      }
    }

    return g
  }

  drawUnit(index: number, data: Record<string, unknown>, g: any): void {
    const props = this.getProperty(index)
    const { centerX, centerY, outerRadius } = props

    const target = this.brush.target ?? []
    const active = (this.brush as Record<string, unknown>).active as string | string[] | null
    const all = 360
    let startAngle = 0
    let max = 0

    for (let i = 0; i < target.length; i++) {
      max += data[target[i]] as number
    }

    if ((this.brush as Record<string, unknown>)['3d']) {
      for (let i = 0; i < target.length; i++) {
        if (data[target[i]] == 0) continue

        const value = data[target[i]] as number
        const endAngle = all * (value / max)

        const pie3d = this.drawPie3d(centerX, centerY, outerRadius, startAngle, endAngle, colorUtil.darken(this.color(i) as string, 0.5))
        g.append(pie3d)

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
      const pie = this.drawPie(centerX, centerY, outerRadius, startAngle, endAngle, this.color(i))
      const text = this.drawText(centerX, centerY, centerAngle, outerRadius, this.getFormatText(target[i], value, max))

      this.cache_active[centerAngle] = {
        active: false,
        pie,
        text,
        centerX,
        centerY,
        centerAngle,
        outerRadius,
      }

      if (!isOnlyOne) {
        if (active === target[i] || (Array.isArray(active) && active.includes(target[i]))) {
          this.cache_active[centerAngle].active = true
        } else {
          this.cache_active[centerAngle].active = false
        }

        if ((this.brush as Record<string, unknown>).showText === 'inside') {
          this.setActiveTextEvent(this.cache_active)
        }

        this.setActiveEvent(this.cache_active, true)

        if ((this.brush as Record<string, unknown>).activeEvent != null) {
          const p = pie
          const t = text.get(0)
          const ca = centerAngle

          p.on((this.brush as Record<string, unknown>).activeEvent, () => {
            this.cache_active[ca].active = !this.cache_active[ca].active

            if ((this.brush as Record<string, unknown>).showText === 'inside') {
              this.setActiveTextEvent(this.cache_active)
            }

            this.setActiveEvent(this.cache_active, true)
          })

          p.attr({ cursor: 'pointer' })
          void t
        }
      }

      this.addEvent(pie, index, i)
      g.append(pie)
      g.append(text)

      startAngle += endAngle
    }
  }

  drawNoData(g: any): void {
    const props = this.getProperty(0)

    g.append(this.drawPie(props.centerX, props.centerY, props.outerRadius, 0, 360, this.chart.theme('pieNoDataBackgroundColor')))
  }

  drawBefore = (): void => {
    this.g = this.chart.svg.group()
  }

  draw = (): any => {
    if (this.listData().length == 0) {
      this.drawNoData(this.g)
    } else {
      this.eachData((data, i) => {
        this.drawUnit(i as number, data as Record<string, unknown>, this.g)
      })
    }

    return this.g
  }

  getProperty(index: number): { centerX: number; centerY: number; outerRadius: number } {
    const obj = (this.axis.c as unknown as (i: number) => { width: number; height: number; x: number; y: number })(index)

    const width = obj.width
    const height = obj.height
    const x = obj.x
    const y = obj.y
    let min = width

    if (height < min) {
      min = height
    }

    return {
      centerX: width / 2 + x,
      centerY: height / 2 + y,
      outerRadius: min / 2,
    }
  }

  static setup(): Record<string, unknown> {
    return PIE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('pie', PieBrush)
