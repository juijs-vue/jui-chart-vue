// Port of legacy `src/brush/equalizercolumn.js` ("chart.brush.equalizercolumn", extend:
// "chart.brush.stackcolumn") - extends `StackColumnBrush` (confirmed from the legacy file's own
// `extend:` field). Same "block-train" quirk as `EqualizerBarBrush` (see that file's header
// comment), transposed to the y-axis.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { StackColumnBrush } from './stackcolumn'
import type { StackColumnBrushOptions } from './stackcolumn'

/** `chart.brush.equalizercolumn`'s own config fields (on top of the inherited
 * `StackColumnBrushOptions`) - same "block-train" `unit` divisor as `EqualizerBarBrush`,
 * transposed to the y-axis. */
export interface EqualizerColumnBrushOptions extends StackColumnBrushOptions {
  /** Divisor controlling how many small blocks each row's "train" is split into. */
  unit?: number
}

/** Own `chart.brush.equalizercolumn.setup()` fields - see legacy `equalizercolumn.js`. */
export const EQUALIZER_COLUMN_BRUSH_OWN_DEFAULTS: EqualizerColumnBrushOptions = {
  unit: 1,
}

export class EqualizerColumnBrush extends StackColumnBrush {
  // Same confirmed-dead-in-legacy `zeroY` closure var omission as `EqualizerBarBrush`'s `zeroX`
  // (see that file's comment) - `equalizercolumn.js`'s `draw()` recomputes its own local `startY`.
  private ecBarWidth = 0
  private ecReverse = false

  drawBefore = (): void => {
    this.g = this.svg.group()
    this.ecBarWidth = this.getTargetSize()
    this.ecReverse = !!(this.axis.get('y') as Record<string, unknown>).reverse
  }

  draw = (): any => {
    const targets = this.brush.target ?? []
    const padding = (this.brush as Record<string, unknown>).innerPadding as number
    const band = (this.axis.y as BrushAxisScale).rangeBand!()
    const unit = band / (((this.brush as Record<string, unknown>).unit as number) * padding)
    const height = unit + padding

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const startX = this.offset('x', index) - this.ecBarWidth / 2
      let startY = (this.axis.y as BrushAxisScale)(0)
      let y = startY
      let value = 0

      for (let j = 0; j < targets.length; j++) {
        const barGroup = this.svg.group()
        const yValue = (row[targets[j]] as number) + value
        const endY = (this.axis.y as BrushAxisScale)(yValue)
        const targetHeight = Math.abs(startY - endY)
        let targetY = targetHeight

        while (targetY >= height) {
          const r = this.getBarElement(index, j)

          r.attr({
            x: startX,
            y,
            width: this.ecBarWidth,
            height: unit,
          })

          targetY -= height
          y += this.ecReverse ? height : -height

          barGroup.append(r)
        }

        barGroup.translate(0, this.ecReverse ? 0 : -unit)
        this.addEvent(barGroup, index, j)
        this.g.append(barGroup)

        startY = endY
        value = yValue
      }
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return EQUALIZER_COLUMN_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('equalizercolumn', EqualizerColumnBrush)
