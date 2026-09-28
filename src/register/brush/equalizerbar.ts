// Port of legacy `src/brush/equalizerbar.js` ("chart.brush.equalizerbar", extend:
// "chart.brush.stackbar") - extends `StackBarBrush` DIRECTLY (confirmed from the legacy file's own
// `extend:` field - self-contained, does NOT need `chart.brush.equalizer`, which is a separate,
// later-batch brush family entirely unrelated to this one despite the shared name prefix). Reuses
// `getBarElement`/`addEvent`/`getTargetSize`/`static setup()`-chain unchanged; only `drawBefore`/
// `draw` are overridden with the "block-train" rendering (a row's stacked segments are rendered as
// a train of small fixed-size blocks with gaps, not a single continuous rect per segment).
//
// **Preserved quirk (source-confirmed via `main` branch's `useSeries.ts`
// `equalizerStackedBlocks()` doc comment, which independently derived and documented the same
// finding from this exact file)**: the running pixel position (`x`) is a SINGLE variable shared
// across the WHOLE row, declared once before the per-target loop and never reset between targets -
// only the remaining capacity (`targetX`) resets per target. So block placement is really one
// continuous sequential "train" starting at the row's zero-axis position, split into consecutive
// per-target runs - each run continues immediately from wherever the PREVIOUS target's run left
// off, not realigned to that target's own true cumulative pixel boundary. A faithfully-preserved
// upstream imprecision, not a bug introduced by this port - ported as a direct, literal translation
// of the same loop (not via the `main` branch's abstracted `equalizerStackedBlocks()` helper,
// consistent with this whole project's "port the legacy imperative code directly" convention).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { StackBarBrush } from './stackbar'
import type { StackBarBrushOptions } from './stackbar'

/** `chart.brush.equalizerbar`'s own config fields (on top of the inherited
 * `StackBarBrushOptions`). Note `unit` here is a divisor controlling block count/spacing
 * (`band / (unit * padding)`) - semantically different from `equalizer.ts`'s same-named `unit`,
 * which is a literal pixel block height there. */
export interface EqualizerBarBrushOptions extends StackBarBrushOptions {
  /** Divisor controlling how many small blocks each row's "train" is split into (larger = fewer,
   * bigger blocks). */
  unit?: number
}

/** Own `chart.brush.equalizerbar.setup()` fields - see legacy `equalizerbar.js`. */
export const EQUALIZER_BAR_BRUSH_OWN_DEFAULTS: EqualizerBarBrushOptions = {
  unit: 1,
}

export class EqualizerBarBrush extends StackBarBrush {
  // Legacy `equalizerbar.js`'s own `drawBefore()` also computes `zeroX = this.axis.x(0)` into a
  // closure var - confirmed dead in the legacy source (`draw()` recomputes its own local `startX =
  // this.axis.x(0)` instead of reusing it) - not reproduced as a field for the same
  // `noUnusedLocals` reason documented in `stackbar.ts`.
  private ebBarHeight = 0
  private ebReverse = false

  /** Overrides `StackBarBrush.drawBefore()`: caches the shared row lane height (via the inherited
   * `getTargetSize()`) and whether the x-axis is reversed (`axis.get('x').reverse`), which flips
   * which direction the block "train" advances in `draw()`. */
  drawBefore = (): void => {
    this.g = this.svg.group()
    this.ebBarHeight = this.getTargetSize()
    this.ebReverse = !!(this.axis.get('x') as Record<string, unknown>).reverse
  }

  /** Overrides `StackBarBrush.draw()` with the "block-train" rendering: each row's stacked segments
   * become a sequence of small fixed-size blocks (width `unit = band / (brush.unit * padding)`,
   * spaced by `padding`) filling each target's pixel span, reusing the inherited `getBarElement()`
   * for each block's own styling. See this file's header comment for the preserved quirk that the
   * running pixel cursor `x` is one variable shared across the WHOLE row (never reset per target,
   * only the remaining-capacity `targetX` is), so each target's blocks continue exactly where the
   * previous target's left off rather than realigning to that target's own true boundary. */
  draw = (): any => {
    const targets = this.brush.target ?? []
    const padding = (this.brush as Record<string, unknown>).innerPadding as number
    const band = (this.axis.x as BrushAxisScale).rangeBand!()
    const unit = band / (((this.brush as Record<string, unknown>).unit as number) * padding)
    const width = unit + padding

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const startY = this.offset('y', index) - this.ebBarHeight / 2
      let startX = (this.axis.x as BrushAxisScale)(0)
      let x = startX
      let value = 0

      for (let j = 0; j < targets.length; j++) {
        const barGroup = this.svg.group()
        const xValue = (row[targets[j]] as number) + value
        const endX = (this.axis.x as BrushAxisScale)(xValue)
        const targetWidth = Math.abs(startX - endX)
        let targetX = targetWidth

        while (targetX >= width) {
          const r = this.getBarElement(index, j)

          r.attr({
            x,
            y: startY,
            width: unit,
            height: this.ebBarHeight,
          })

          targetX -= width
          x -= this.ebReverse ? width : -width

          barGroup.append(r)
        }

        barGroup.translate(this.ebReverse ? -unit : 0, 0)
        this.addEvent(barGroup, index, j)
        this.g.append(barGroup)

        startX = endX
        value = xValue
      }
    })

    return this.g
  }

  /** Returns this brush's own default options (`unit`), merged by `defineOptions()` on top of the
   * inherited `StackBarBrush`/`CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return EQUALIZER_BAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('equalizerbar', EqualizerBarBrush)
