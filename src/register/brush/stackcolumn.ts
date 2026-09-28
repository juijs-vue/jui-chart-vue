// Port of legacy `src/brush/stackcolumn.js` ("chart.brush.stackcolumn", extend:
// "chart.brush.stackbar") - extends `StackBarBrush` (confirmed from the legacy file's own
// `extend:` field - NOT `ColumnBrush`), reusing `getBarElement`/`setActiveEffect`/
// `setActiveEffectOption`/`setActiveEvent`/`setActiveEventOption`/`drawStackTooltip`/
// `drawStackEdge`/`static setup()` unchanged; only `getTargetSize`/`drawBefore`/`draw` are
// overridden (matching legacy `stackcolumn.js`'s own scope - it defines no `static setup()` of its
// own either, so `StackColumnBrush.setup` resolves to `StackBarBrush.setup` via real JS static
// inheritance, exactly like `ColumnBrush`/`BarBrush` in Phase 1).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { StackBarBrush } from './stackbar'
import type { StackBarBrushOptions } from './stackbar'

/** `chart.brush.stackcolumn` has no `setup()` of its own - it inherits `StackBarBrush`'s options
 * verbatim. Re-exported under this name purely so a generated doc page for `"stackcolumn"` has
 * something to point at. */
export type StackColumnBrushOptions = StackBarBrushOptions

/**
 * `chart.brush.stackcolumn`: the vertical-column counterpart to `StackBarBrush` - extends it
 * directly (not `ColumnBrush`), reusing `getBarElement`/`setActiveEffect`/`drawStackTooltip`/
 * `drawStackEdge`/`static setup()` unchanged, and overriding only `getTargetSize`/`drawBefore`/
 * `draw` to lay segments out vertically instead of horizontally.
 */
export class StackColumnBrush extends StackBarBrush {
  private stackColWidth = 0

  /** Column-axis counterpart to `StackBarBrush.getTargetSize`: derives the shared segment lane
   * width from the x-axis's column band instead of the y-axis's row band. */
  getTargetSize(): number {
    const width = (this.axis.x as BrushAxisScale).rangeBand!()
    const brush = this.brush as Record<string, unknown>

    if ((brush.size as number) > 0) {
      return brush.size as number
    } else {
      const size = width - (brush.outerPadding as number) * 2
      return size < (brush.minSize as number) ? (brush.minSize as number) : size
    }
  }

  /** Column-axis counterpart to `StackBarBrush.drawBefore`: caches `stackColWidth` (via the
   * overridden `getTargetSize()`) instead of `stackBarSize`, resetting the same per-draw tooltip/
   * edge tracking arrays. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.stackColWidth = this.getTargetSize()

    this.stackTooltips = []
    this.tooltipIndexes = []
    this.edgeData = []
  }

  /** Column-axis counterpart to `StackBarBrush.draw`: stacks every target's segment upward along y
   * (instead of rightward along x) within one shared `stackColWidth` lane, reusing the same
   * `getBarElement`/`drawStackTooltip`/`drawStackEdge`/`setActiveEventOption`/`setActiveTooltips`/
   * `setActiveEffectOption` machinery inherited from `StackBarBrush` unchanged. */
  draw = (): any => {
    const target = this.brush.target ?? []
    let maxIndex: number | null = null
    let maxValue = 0
    let minIndex: number | null = null
    let minValue = (this.axis.y as BrushAxisScale & { max(): number }).max()
    const isReverse = (this.axis.get('y') as Record<string, unknown>).reverse

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const group = this.chart.svg.group()

      const offsetX = this.offset('x', index)
      const startX = offsetX - this.stackColWidth / 2
      let startY = (this.axis.y as BrushAxisScale)(0)
      let value = 0
      let sumValue = 0

      for (let j = 0; j < target.length; j++) {
        const yValue = (row[target[j]] as number) + value
        const endY = (this.axis.y as BrushAxisScale)(yValue)
        const opts = {
          x: startX,
          y: startY > endY ? endY : startY,
          width: this.stackColWidth,
          height: Math.abs(startY - endY),
        }
        const r = this.getBarElement(index, j).attr(opts)

        if (!this.edgeData[index]) {
          this.edgeData[index] = {}
        }

        this.edgeData[index][j] = {
          color: this.color(j),
          dx: 0,
          dy: isReverse ? opts.height : 0,
          ex: 0,
          ey: isReverse ? 0 : opts.height,
          ...opts,
        }

        startY = endY
        value = yValue
        sumValue += row[target[j]] as number

        group.append(r)
      }

      if (sumValue > maxValue) {
        maxValue = sumValue
        maxIndex = index
      }
      if (sumValue < minValue) {
        minValue = sumValue
        minIndex = index
      }

      this.drawStackTooltip(group, index, sumValue, offsetX, startY, isReverse ? 'bottom' : 'top')
      this.setActiveEventOption(group)
      this.addBarElement(group)
      this.g.append(group)
    })

    if ((this.brush as Record<string, unknown>).edge) {
      this.drawStackEdge(this.g)
    }

    if ((this.brush as Record<string, unknown>).display != null) {
      this.setActiveTooltips(minIndex, maxIndex)
    }

    this.setActiveEffectOption()

    return this.g
  }
}

registerBrush('stackcolumn', StackColumnBrush)
