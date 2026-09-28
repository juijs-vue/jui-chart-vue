// Port of legacy `src/brush/equalizer.js` ("chart.brush.equalizer", extend: "chart.brush.core") -
// extends `CoreBrush` directly. Genuinely distinct from `equalizerbar.js`/`equalizercolumn.js`
// (Batch 1, `extend: "chart.brush.stackbar"`/`"chart.brush.stackcolumn"` respectively) despite the
// shared "equalizer" name prefix - confirmed from source (this file's own `extend:` field) and
// cross-checked against `main` branch's `EqualizerChart.vue` header comment, which independently
// confirmed the same finding. Only ONE orientation exists (x=block/category, y=range/value,
// grouped - not stacked - targets side by side, exactly like a non-stacked `column`-orient chart).
//
// Each (row, target) pair renders as a STACK of small fixed-height blocks (`brush.unit`, a literal
// pixel height here - unrelated to `equalizerbar.js`'s same-named but semantically different
// `unit`, a divisor there) growing away from the zero baseline toward the value's pixel position,
// separated by a constant HARDCODED 1.5px gap (`padding = 1.5`, NOT the configurable
// `innerPadding`, which here only spaces the grouped targets apart horizontally). The block
// nearest the value's edge is clipped short instead of overshooting, so the stack always lands
// exactly on the value's true position. Per-block color banding: `this.color(Math.floor(eIndex /
// brush.gap))` - every `gap` consecutive blocks (counted from 0 at the end nearest zero) share one
// theme color, then the next `gap` blocks cycle to the next color - a color-banded VU-meter look,
// genuinely different from `equalizerbar.js`/`equalizercolumn.js`'s one-uniform-color-per-target
// coloring. No `value === 0` guard exists in the source (a zero-value target naturally produces
// zero blocks, so there's nothing visible either way) - ported literally, unconditional.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'

/** `chart.brush.equalizer`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface EqualizerBrushOptions {
  /** Gap in px between adjacent grouped targets' block-stacks within the same row. */
  innerPadding?: number
  /** Padding reserved at the left/right of each row's block-stack group. */
  outerPadding?: number
  /** Fixed pixel height of each small block in a stack (blocks grow from zero toward the value,
   * separated by a constant 1.5px gap - see this file's header comment). */
  unit?: number
  /** Number of consecutive blocks (counted from zero) that share one theme color before cycling
   * to the next, for the color-banded VU-meter look. */
  gap?: number
}

/** Own `chart.brush.equalizer.setup()` fields - see legacy `equalizer.js`. */
export const EQUALIZER_BRUSH_OWN_DEFAULTS: EqualizerBrushOptions = {
  innerPadding: 10,
  outerPadding: 15,
  unit: 5,
  gap: 5,
}

export class EqualizerBrush extends CoreBrush {
  private g: any
  private zeroY = 0
  private eqWidth = 0
  private barWidth = 0
  private half_width = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const target = this.brush.target ?? []

    this.g = this.chart.svg.group()
    this.zeroY = (this.axis.y as BrushAxisScale)(0)
    this.eqWidth = (this.axis.x as BrushAxisScale).rangeBand!()
    this.half_width = (this.eqWidth - (brush.outerPadding as number) * 2) / 2
    this.barWidth = (this.eqWidth - (brush.outerPadding as number) * 2 - (target.length - 1) * (brush.innerPadding as number)) / target.length
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = this.brush.target ?? []
    const unit = brush.unit as number
    const gap = brush.gap as number
    const innerPadding = brush.innerPadding as number

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      let startX = this.offset('x', index) - this.half_width

      for (let j = 0; j < target.length; j++) {
        const barGroup = this.chart.svg.group()
        const startY = (this.axis.y as BrushAxisScale)(row[target[j]])
        const padding = 1.5
        let eY = this.zeroY
        let eIndex = 0

        if (startY <= this.zeroY) {
          while (eY > startY) {
            const unitHeight = eY - unit < startY ? Math.abs(eY - startY) : unit
            const r = this.chart.svg.rect({
              x: startX,
              y: eY - unitHeight,
              width: this.barWidth,
              height: unitHeight,
              fill: this.color(Math.floor(eIndex / gap)),
            })

            eY -= unitHeight + padding
            eIndex++

            barGroup.append(r)
          }
        } else {
          while (eY < startY) {
            const unitHeight = eY + unit > startY ? Math.abs(eY - startY) : unit
            const r = this.chart.svg.rect({
              x: startX,
              y: eY,
              width: this.barWidth,
              height: unitHeight,
              fill: this.color(Math.floor(eIndex / gap)),
            })

            eY += unitHeight + padding
            eIndex++

            barGroup.append(r)
          }
        }

        this.addEvent(barGroup, index, j)
        this.g.append(barGroup)

        startX += this.barWidth + innerPadding
      }
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return EQUALIZER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('equalizer', EqualizerBrush)
