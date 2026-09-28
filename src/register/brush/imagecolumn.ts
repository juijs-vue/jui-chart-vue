// Port of legacy `src/brush/imagecolumn.js` ("chart.brush.imagecolumn", extend:
// "chart.brush.imagebar") - the vertical-column counterpart to `imagebar.ts` (extends
// `ImageBarBrush`, confirmed from the legacy file's own `extend:` field), reusing its inherited
// `getImageURI()`/`getBarStyle()` unchanged, with its own x/y-swapped `drawBefore()`/`draw()`.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'
import { ImageBarBrush } from './imagebar'
import type { ImageBarBrushOptions } from './imagebar'

/** `chart.brush.imagecolumn` has no `setup()` of its own - it inherits `ImageBarBrush`'s options
 * verbatim. Re-exported under this name purely so a generated doc page for `"imagecolumn"` has
 * something to point at. */
export type ImageColumnBrushOptions = ImageBarBrushOptions

/**
 * `chart.brush.imagecolumn`: the vertical-column counterpart to `ImageBarBrush` - same
 * image-or-fallback-rect bar rendering (see `ImageBarBrush`'s own class doc/header comment), just
 * with x/y swapped so bars grow upward from the column axis's zero line instead of horizontally.
 * Reuses `getImageURI()`/`getBarStyle()` unchanged; only `drawBefore()`/`draw()` are overridden.
 */
export class ImageColumnBrush extends ImageBarBrush {
  private zeroY = 0
  private halfWidth = 0

  /** Column-axis counterpart to `ImageBarBrush.drawBefore`: caches the zero-value y coordinate
   * (`zeroY`) instead of `zeroX`, and the combined width of one column's stacked per-target images
   * plus their `innerPadding` gaps (`halfWidth`, used to horizontally center them within the
   * column band) instead of `halfHeight`. Also calls `axis.x.rangeBand()` without storing its
   * result - dead in the legacy source too, see this line's own inline comment and `hudbar.ts`'s
   * identical convention note. */
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

  /** Column-axis counterpart to `ImageBarBrush.draw`: draws each row's stack of target images
   * growing vertically (height instead of width driven by the resolved value), anchored so the
   * bar always starts at `zeroY` and extends up toward the value when the value's y coordinate is
   * above the baseline, or down toward `zeroY` otherwise. Rows whose value is `0` skip
   * `addEvent()`, same as `ImageBarBrush.draw`. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      let startX = this.offset('x', index) - this.halfWidth / 2

      for (let j = 0; j < this.targets.length; j++) {
        const value = row[this.targets[j]]
        const startY = (this.axis.y as BrushAxisScale)(value)
        const height = Math.abs(this.zeroY - startY)

        const bar = this.chart.svg.group({}, () => {
          const img = this.chart.svg.image({
            width: this.colWidth,
            height: this.colHeight,
            'xlink:href': this.getImageURI(this.targets[j], value),
          })

          if (brush.fixed) {
            let h = height - this.colHeight
            const style = this.getBarStyle()

            if (h < 0) h = 0

            this.chart.svg.rect({
              y: this.colHeight,
              width: this.colWidth,
              height: h,
              fill: this.color(index, j),
              stroke: style.borderColor,
              'stroke-width': style.borderWidth,
              'stroke-opacity': style.borderOpacity,
            })
          } else {
            if (height > 0 && this.colHeight > 0) {
              img.scale(1, height > this.colHeight ? height / this.colHeight : this.colHeight / height)
            }
          }
        })

        if (value != 0) {
          this.addEvent(bar, index, j)
        }

        if (startY <= this.zeroY) {
          bar.translate(startX, startY)
        } else {
          bar.translate(startX, this.zeroY)
        }

        this.g.append(bar)

        startX += this.colWidth + this.padding
      }
    })

    return this.g
  }
}

registerBrush('imagecolumn', ImageColumnBrush)
