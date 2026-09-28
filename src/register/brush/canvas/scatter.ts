// Port of legacy `src/brush/canvas/scatter.js` ("chart.brush.canvas.scatter", extend:
// "chart.brush.canvas.core") - a canvas-rendered scatter brush drawing one of 4 symbols (circle/
// rect/triangle/cross) per `(dataIndex, targetIndex)` cell directly with raw
// `CanvasRenderingContext2D` calls (no SVG element per point, unlike `scatter.ts`).
import { registerBrush, CanvasCoreBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

type ScatterSymbol = 'circle' | 'rect' | 'rectangle' | 'triangle' | 'cross' | ((this: unknown, target: string, value: unknown) => string)

/** `chart.brush.canvas.scatter`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface CanvasScatterBrushOptions {
  /** Marker shape for every point, or a callback resolving it per `(target, value)` cell. */
  symbol?: ScatterSymbol
  /** Marker width/height in px. */
  size?: number
}

/** Own `chart.brush.canvas.scatter.setup()` fields - see legacy `canvas/scatter.js`. */
export const CANVAS_SCATTER_BRUSH_OWN_DEFAULTS: CanvasScatterBrushOptions = {
  symbol: 'circle',
  size: 7,
}

export class CanvasScatterBrush extends CanvasCoreBrush {
  private createScatter(data: BrushData, target: string, dataIndex: number, targetIndex: number): void {
    const brush = this.brush as Record<string, unknown>
    const symbol = brush.symbol as ScatterSymbol
    const type = typeof symbol === 'function' ? symbol.call(this.chart, target, data[target]) : symbol
    const color = this.color(dataIndex, targetIndex)
    const r = (brush.size as number) / 2
    const x = (this.axis.x as BrushAxisScale)(dataIndex)
    const y = (this.axis.y as BrushAxisScale)(data[target])
    const canvas = this.canvas as CanvasRenderingContext2D

    if (type == 'circle') {
      canvas.fillStyle = color
      canvas.beginPath()
      canvas.arc(x, y, r, 0, 2 * Math.PI, false)
      canvas.fill()
      canvas.closePath()
    } else if (type == 'rect' || type == 'rectangle') {
      canvas.fillStyle = color
      canvas.fillRect(x - r, y - r, r * 2, r * 2)
    } else if (type == 'triangle') {
      canvas.fillStyle = color
      canvas.beginPath()
      canvas.moveTo(x, y - r)
      canvas.lineTo(x - r, y + r)
      canvas.lineTo(x + r, y + r)
      canvas.lineTo(x, y - r)
      canvas.fill()
      canvas.closePath()
    } else if (type == 'cross') {
      canvas.strokeStyle = color
      canvas.beginPath()
      canvas.moveTo(x - r, y - r)
      canvas.lineTo(x + r, y + r)
      canvas.stroke()
      canvas.closePath()
      canvas.beginPath()
      canvas.moveTo(x + r, y - r)
      canvas.lineTo(x - r, y + r)
      canvas.stroke()
      canvas.closePath()
    }
  }

  draw = (): void => {
    const datas = this.listData() as BrushData[]
    const targets = (this.brush as Record<string, unknown>).target as string[]

    for (let i = 0; i < datas.length; i++) {
      for (let j = 0; j < targets.length; j++) {
        this.createScatter(datas[i], targets[j], i, j)
      }
    }
  }

  static setup(): Record<string, unknown> {
    return CANVAS_SCATTER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('canvas.scatter', CanvasScatterBrush)
