// Port of legacy `src/brush/canvas/equalizercolumn.js` ("chart.brush.canvas.equalizercolumn",
// extend: "chart.brush.canvas.core") - a canvas-rendered "audio equalizer" stacked-block column
// brush (draws discrete horizontal-bar "cells" up a column, plus a small pulsing animated overlay
// bar + running total label) drawn with raw `CanvasRenderingContext2D` calls, unlike the
// already-registered SVG `chart.brush.equalizercolumn` (`register/brush/equalizercolumn.ts`,
// `extend: "chart.brush.stackcolumn"`, a COMPLETELY DIFFERENT legacy source file/class despite the
// shared display name) - hence the disambiguated `"canvas.equalizercolumn"` registration type this
// task specifies, keeping both side by side.
import { registerBrush, CanvasCoreBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

interface ChartWithCache {
  getCache(key: string, defValue?: unknown): unknown
  setCache(key: string, value: unknown): void
}

interface BarRect {
  fill: string
  'fill-opacity': number
  stroke: unknown
  'stroke-width': unknown
  'stroke-opacity': unknown
  hidden: boolean
  x: number
  y: number
  width: number
  height: number
}

/** `chart.brush.canvas.equalizercolumn`'s own config fields (on top of `jui-graph-ts`'s
 * `BrushOptions`). */
export interface CanvasEqualizerColumnBrushOptions {
  /** Fixed column width in px; `0` auto-derives it from the row band width minus
   * `outerPadding` (falling back to `minSize` if that would be smaller). */
  size?: number
  /** Floor for the auto-derived column width when `size` is `0`. */
  minSize?: number
  /** Horizontal gap in px reserved on each side of a column's band before auto-deriving `size`. */
  outerPadding?: number
  /** Gap in px between each discrete stacked "cell" within a column. */
  innerPadding?: number
  /** Value each discrete stacked cell represents, combined with `innerPadding` to derive one
   * cell's pixel height. */
  unit?: number
  /** Column index (or indices) to draw at full opacity; every other column is dimmed to the
   * theme's `barDisableBackgroundOpacity`. `null` draws every column at full opacity. */
  active?: number | number[] | null
  /** Column index (or indices) to render as an error placeholder (`errorText` label, no bars)
   * instead of its normal stacked cells. `null` draws no error columns. */
  error?: number | number[] | null
  /** Label text shown on a column flagged by `error`. */
  errorText?: string
}

/** Own `chart.brush.canvas.equalizercolumn.setup()` fields - see legacy
 * `canvas/equalizercolumn.js`. */
export const CANVAS_EQUALIZERCOLUMN_BRUSH_OWN_DEFAULTS: CanvasEqualizerColumnBrushOptions = {
  size: 0,
  minSize: 0,
  outerPadding: 15,
  innerPadding: 1,
  unit: 1,
  active: null,
  error: null,
  errorText: 'Stopped',
}

export class CanvasEqualizerColumnBrush extends CanvasCoreBrush {
  private ecZeroY = 0
  private ecBarWidth = 0
  private ecReverse = false

  private getTargetSize(): number {
    const brush = this.brush as Record<string, unknown>
    const width = (this.axis.x as BrushAxisScale).rangeBand!()

    if ((brush.size as number) > 0) {
      return brush.size as number
    } else {
      const size = width - (brush.outerPadding as number) * 2
      return size < (brush.minSize as number) ? (brush.minSize as number) : size
    }
  }

  private getBarStyle(): { borderColor: unknown; borderWidth: unknown; borderOpacity: unknown; borderRadius: unknown; disableOpacity: unknown; circleColor: unknown } {
    return {
      borderColor: this.chart.theme('barBorderColor'),
      borderWidth: this.chart.theme('barBorderWidth'),
      borderOpacity: this.chart.theme('barBorderOpacity'),
      borderRadius: this.chart.theme('barBorderRadius'),
      disableOpacity: this.chart.theme('barDisableBackgroundOpacity'),
      circleColor: this.chart.theme('barPointBorderColor'),
    }
  }

  private getBarElement(dataIndex: number, targetIndex: number): BarRect {
    const brush = this.brush as Record<string, unknown>
    const style = this.getBarStyle()
    const color = this.color(targetIndex)
    const value = (this.getData(dataIndex) as BrushData)[(brush.target as string[])[targetIndex]]
    const active = brush.active as number | number[] | null
    let opacity = 1

    if ((Array.isArray(active) && !active.includes(dataIndex)) || (typeof active === 'number' && active !== dataIndex)) {
      opacity = style.disableOpacity as number
    }

    return {
      fill: color,
      'fill-opacity': opacity,
      stroke: style.borderColor,
      'stroke-width': style.borderWidth,
      'stroke-opacity': style.borderOpacity,
      hidden: value == 0,
    } as BarRect
  }

  private isErrorColumn(i: number): boolean {
    const error = (this.brush as Record<string, unknown>).error as number | number[] | null

    if ((Array.isArray(error) && !error.includes(i)) || (typeof error === 'number' && error !== i) || error === null) {
      return false
    }

    return true
  }

  drawBefore = (): void => {
    this.ecZeroY = (this.axis.y as BrushAxisScale)(0)
    this.ecBarWidth = this.getTargetSize()
    this.ecReverse = !!(this.axis.get('y') as Record<string, unknown>).reverse
  }

  draw = (): void => {
    const canvas = this.canvas as CanvasRenderingContext2D
    const chart = this.chart as unknown as ChartWithCache
    const brush = this.brush as Record<string, unknown>
    const targets = brush.target as string[]
    const padding = brush.innerPadding as number
    const band = (this.axis.y as BrushAxisScale).rangeBand!()
    const unit = band / ((brush.unit as number) * padding)
    const height = unit + padding
    const translateY = this.ecReverse ? 0 : -unit

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const offsetX = this.offset('x', index)
      const startX = offsetX - this.ecBarWidth / 2
      let startY = this.ecZeroY
      let y = startY
      let value = 0
      const stackList: BarRect[] = []

      for (let j = 0; j < targets.length; j++) {
        const yValue = (row[targets[j]] as number) + value
        const endY = (this.axis.y as BrushAxisScale)(yValue)
        let targetY = Math.abs(startY - endY)

        if (!this.isErrorColumn(index)) {
          while (targetY >= height) {
            const r = { ...this.getBarElement(index, j), x: startX, y: y + translateY, width: this.ecBarWidth, height: unit }

            targetY -= height
            y += this.ecReverse ? height : -height

            canvas.save()
            canvas.globalAlpha = r['fill-opacity']
            canvas.beginPath()
            canvas.fillStyle = r.fill
            canvas.strokeStyle = r.stroke as string
            canvas.lineWidth = r['stroke-width'] as number
            canvas.rect(r.x, r.y, r.width, r.height)
            canvas.fill()
            canvas.restore()

            stackList.push(r)
          }
        } else {
          const size = Math.min((this.axis.x as BrushAxisScale).rangeBand!(), this.axis.area('height')) * 0.4
          const errorHeight = this.axis.area('height') * 0.5
          const tick = size * 0.3
          const errX = offsetX - size / 2
          const fontSize = errorHeight / 5
          const yt = y - tick
          const yht = y - errorHeight - tick
          const round = 5

          canvas.save()
          canvas.beginPath()
          canvas.fillStyle = this.chart.theme('equalizerColumnErrorBackgroundColor') as string
          canvas.moveTo(offsetX, y)
          canvas.lineTo(errX, yt)
          canvas.lineTo(errX, yht + round)
          canvas.arcTo(errX, yht, errX + round, yht, round)
          canvas.lineTo(errX + size - round, yht)
          canvas.arcTo(errX + size, yht, errX + size, yht + round, round)
          canvas.lineTo(errX + size, yt)
          canvas.fill()

          canvas.save()
          canvas.font = `${fontSize}px ${this.chart.theme('fontFamily')}`
          canvas.translate(offsetX, y - errorHeight - tick)
          canvas.rotate(Math.PI / 2)
          canvas.textAlign = 'center'
          canvas.fillStyle = this.chart.theme('equalizerColumnErrorFontColor') as string
          canvas.fillText(brush.errorText as string, errorHeight / 1.75, fontSize / 3)

          canvas.restore()
        }

        startY = endY
        value = yValue
      }

      if (stackList.length > 0) {
        chart.setCache(`equalizer_${index}`, stackList[stackList.length - 1])
        chart.setCache(`raycast_area_${index}`, {
          x1: stackList[0].x,
          x2: stackList[0].x + stackList[0].width,
          y2: (this.axis.y as BrushAxisScale)((this.axis.y as unknown as { min(): unknown }).min()),
          y1: stackList[stackList.length - 1].y,
        })
      }
    })

    this.drawAnimation()
  }

  private drawAnimation(): void {
    const canvas = this.canvas as CanvasRenderingContext2D
    const chart = this.chart as unknown as ChartWithCache
    const brush = this.brush as Record<string, unknown>
    const MAX_DISTANCE = 8
    const UP_SEC_PER_MOVE = 20
    const DOWN_SEC_PER_MOVE = 30
    const TOP_PADDING = -3
    const TOTAL_PADDING = -8

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number

      if (!this.isErrorColumn(index)) {
        const r = chart.getCache(`equalizer_${index}`) as BarRect | undefined
        let total = 0

        for (let j = 0; j < (brush.target as string[]).length; j++) {
          total += row[(brush.target as string[])[j]] as number
        }

        if (r != null) {
          const tpf = chart.getCache('tpf', 1) as number
          const status = (chart.getCache(`equalizer_move_${index}`, { direction: -1, distance: 0 }) as { direction: number; distance: number }) ?? {
            direction: -1,
            distance: 0,
          }
          const speed = status.direction == -1 ? UP_SEC_PER_MOVE : DOWN_SEC_PER_MOVE

          status.distance += status.direction * speed * tpf

          if (Math.abs(status.distance) >= MAX_DISTANCE) {
            status.direction = 1
          } else if (status.distance >= 0) {
            status.direction = -1
          }

          if (status.distance < -MAX_DISTANCE) {
            status.distance = -MAX_DISTANCE
          } else if (status.distance > 0) {
            status.distance = 0
          }

          const ry = r.y + status.distance + TOP_PADDING

          canvas.save()
          canvas.globalAlpha = r['fill-opacity']
          canvas.strokeStyle = r.fill
          canvas.lineWidth = r.height * 0.7
          canvas.beginPath()
          canvas.moveTo(r.x, ry)
          canvas.lineTo(r.x + r.width, ry)
          canvas.closePath()
          canvas.stroke()

          canvas.fillStyle = this.chart.theme('barFontColor') as string
          canvas.font = (this.chart.theme('barFontSize') as string) + 'px'
          canvas.textAlign = 'center'
          canvas.textBaseline = 'middle'
          canvas.fillText(String(total), r.x + r.width / 2, ry + TOTAL_PADDING)
          canvas.fill()
          canvas.restore()

          chart.setCache(`equalizer_move_${index}`, status)
        }
      }
    })
  }

  static setup(): Record<string, unknown> {
    return CANVAS_EQUALIZERCOLUMN_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.equalizercolumn', CanvasEqualizerColumnBrush)
