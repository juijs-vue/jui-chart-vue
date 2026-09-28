// Port of legacy `src/brush/patterncolumn.js` ("chart.brush.patterncolumn", extend:
// "chart.brush.patternbar") - the vertical-column counterpart to `patternbar.ts` (extends
// `PatternBarBrush`, confirmed from the legacy file's own `extend:` field), reusing its inherited
// `createPattern()`/`getImageURI()` unchanged, with its own x/y-swapped `drawBefore()`/`draw()`.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'
import { PatternBarBrush } from './patternbar'
import type { PatternBarBrushOptions } from './patternbar'

/** `chart.brush.patterncolumn` has no `setup()` of its own - it inherits `PatternBarBrush`'s
 * options verbatim. Re-exported under this name purely so a generated doc page for
 * `"patterncolumn"` has something to point at. */
export type PatternColumnBrushOptions = PatternBarBrushOptions

export class PatternColumnBrush extends PatternBarBrush {
  private zeroY = 0
  private halfWidth = 0

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>

    this.g = this.chart.svg.group()
    this.targets = (brush.target ?? []) as string[]
    this.padding = brush.innerPadding as number
    this.zeroY = (this.axis.y as BrushAxisScale)(0)
    ;(this.axis.x as BrushAxisScale).rangeBand!() // dead in legacy too (computed, never read again - see hudbar.ts's identical convention note)
    this.colWidth = brush.width as number
    this.colHeight = brush.height as number
    this.halfWidth = this.colWidth * this.targets.length + (this.targets.length - 1) * this.padding
  }

  draw = (): any => {
    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      let startX = this.offset('x', index) - this.halfWidth / 2

      for (let j = 0; j < this.targets.length; j++) {
        const value = row[this.targets[j]]
        const patternId = this.createPattern(this.colWidth, this.colHeight, this.targets[j], value)
        const startY = (this.axis.y as BrushAxisScale)(value)
        const height = Math.abs(this.zeroY - startY)

        const r = this.chart.svg.rect({
          width: this.colWidth,
          height,
          fill: 'url(#' + patternId + ')',
          'stroke-width': 0,
        })

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        if (startY <= this.zeroY) {
          r.translate(startX, startY)
        } else {
          r.translate(startX, this.zeroY)
        }

        this.g.append(r)

        startX += this.colWidth + this.padding
      }
    })

    return this.g
  }
}

registerBrush('patterncolumn', PatternColumnBrush)
