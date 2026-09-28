// Port of legacy `src/brush/fullstackcolumn.js` ("chart.brush.fullstackcolumn", extend:
// "chart.brush.fullstackbar") - extends `FullStackBarBrush` (confirmed from the legacy file's own
// `extend:` field), reusing `drawText()`/`getBarElement`/`setActiveEffect*`/`addBarElement`/
// `static setup()` unchanged; only `getTargetSize`/`drawBefore`/`draw` are overridden (no own
// `static setup()`, matching legacy - resolves to `FullStackBarBrush.setup` via real JS static
// inheritance).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { FullStackBarBrush } from './fullstackbar'
import type { FullStackBarBrushOptions } from './fullstackbar'

/** `chart.brush.fullstackcolumn` has no `setup()` of its own - it inherits `FullStackBarBrush`'s
 * options verbatim (only `getTargetSize`/`drawBefore`/`draw` are overridden for the vertical
 * orientation). Re-exported under this name purely so a generated doc page for
 * `"fullstackcolumn"` has something to point at. */
export type FullStackColumnBrushOptions = FullStackBarBrushOptions

export class FullStackColumnBrush extends FullStackBarBrush {
  private fscWidth = 0

  getTargetSize(): number {
    const width = (this.axis.x as BrushAxisScale).rangeBand!()
    const brush = this.brush as Record<string, unknown>
    let r_width: number

    if ((brush.size as number) > 0) {
      r_width = brush.size as number
    } else {
      r_width = width - (brush.outerPadding as number) * 2
    }

    return r_width < 0 ? 0 : r_width
  }

  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.fscWidth = this.getTargetSize()
  }

  draw = (): any => {
    const target = this.brush.target ?? []
    const chart_height = this.axis.area('height')

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const group = this.chart.svg.group()

      const startX = this.offset('x', index) - this.fscWidth / 2
      let sum = 0
      const list: number[] = []

      for (let j = 0; j < target.length; j++) {
        const height = row[target[j]] as number
        sum += height
        list.push(height)
      }

      let startY = 0
      const max = (this.axis.y as BrushAxisScale & { max(): number }).max()

      for (let j = list.length - 1; j >= 0; j--) {
        const height = chart_height - (this.axis.y as BrushAxisScale & { rate(value: number, max: number): number }).rate(list[j], sum)
        const r = this.getBarElement(index, j)

        if (isNaN(startX) || isNaN(startY) || isNaN(height)) {
          // 정상적인 숫자가 아니면 element 를 설정하지 않음.
        } else {
          r.attr({
            x: startX,
            y: startY,
            width: this.fscWidth,
            height,
          })
        }

        group.append(r)

        if ((this.brush as Record<string, unknown>).showText) {
          const p = Math.round((list[j] / sum) * max)
          const x = startX + this.fscWidth / 2
          const y = startY + height / 2 + 8
          const text = this.drawText(p, x, y)

          if (text != null) group.append(text)
        }

        this.setActiveEventOption(group)

        startY += height
      }

      this.addBarElement(group)
      this.g.append(group)
    })

    this.setActiveEffectOption()

    return this.g
  }
}

registerBrush('fullstackcolumn', FullStackColumnBrush)
