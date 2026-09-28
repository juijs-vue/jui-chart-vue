// Port of legacy `src/brush/fullstackcolumn3d.js` ("chart.brush.fullstackcolumn3d", extend:
// "chart.brush.fullstackbar3d") - extends `FullStackBar3DBrush` (confirmed from the legacy file's
// own `extend:` field), reusing its inherited `drawText()` unchanged but completely overriding
// `drawBefore()`/`drawMain()`(new)/`draw()`, and adding a new `getTextXY()` seam
// `fullstackcylinder3d.ts` (`extend: "chart.brush.fullstackcolumn3d"`) overrides.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'
import { FullStackBar3DBrush } from './fullstackbar3d'
import type { FullStackBar3DBrushOptions } from './fullstackbar3d'

/** `chart.brush.fullstackcolumn3d` has no `setup()` of its own - it inherits
 * `FullStackBar3DBrush`'s options verbatim. Re-exported under this name purely so a generated
 * doc page for `"fullstackcolumn3d"` has something to point at. */
export type FullStackColumn3DBrushOptions = FullStackBar3DBrushOptions

type CAxis = (i: unknown, v: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }
type RateScale = (v: unknown) => number
type RateScaleFull = RateScale & { rate(value: number, max: number): number; max(): number }

/** `chart.brush.fullstackcolumn3d`: the vertical counterpart to `FullStackBar3DBrush` - each
 * column's isometric-extruded box stack always spans the full axis height, with each target's box
 * height computed as its share of that row's own value sum (`yScale.rate(list[j], sum)`) rather than
 * absolute values, stacking bottom-to-top. Box construction (`drawMain()`) and label positioning
 * (`getTextXY()`) are both overridable seams so `FullStackCylinder3DBrush` can swap in a cylinder
 * shape and re-centered labels while reusing this class's layout/event logic. See this file's own
 * header comment for a preserved quirk in the percentage-label positioning: it reassigns the same
 * `xy` local the row's own axis projection used, reading its pre-reassignment `depth` value. */
export class FullStackColumn3DBrush extends FullStackBar3DBrush {
  private width = 0
  private barWidth = 0
  private zeroXY2 = { x: 0, y: 0, depth: 0 }

  /** Overrides `FullStackBar3DBrush.drawBefore()` for the vertical orientation: computes `width`
   * (the x-axis row band) and `barWidth` (that band minus twice `outerPadding`), and `zeroXY2`
   * (the "grid3d" axis's projection of value `0` at column `0`, this orientation's shared y/depth
   * origin). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    this.width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.g = this.chart.svg.group()
    this.barWidth = this.width - (brush.outerPadding as number) * 2
    this.zeroXY2 = (this.axis.c as unknown as CAxis)(0, 0)
  }

  /** Builds one box's 3D shape. New (unrelated to `Column3DBrush.drawMain()`'s method of the same
   * name), and itself an overridable seam so `fullstackcylinder3d.ts`'s
   * `FullStackCylinder3DBrush` (`extend: "chart.brush.fullstackcolumn3d"`) can swap in a cylinder
   * shape while reusing everything else in `draw()`. Here, a plain extruded box via
   * `chart.svg.rect3d()`. */
  drawMain(index: number, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.rect3d(this.color(index), width, height, degree as number, depth)
  }

  /** Returns the label position unchanged (`{x, y}`). An overridable seam - `_index`/`_depth` are
   * unused here but let `fullstackcylinder3d.ts`'s `FullStackCylinder3DBrush` override this to
   * reposition a segment's percentage label to the cylinder's own visual center instead. */
  getTextXY(_index: number, x: number, y: number, _depth: number): { x: number; y: number } {
    return { x, y }
  }

  /** Draws every row's 100%-normalized 3D box stack, vertical counterpart to
   * `FullStackBar3DBrush.draw()`: each box's height comes from `zeroXY2.y - yScale.rate(list[j],
   * sum)` - its share of THAT ROW's own value sum, not the axis's global max - so every column's
   * stack always spans the same total height. Boxes are placed bottom-to-top from the shared
   * `zeroXY2.y` origin via `drawMain()`, each shifted by the isometric depth compensation
   * (`sin(radian) * depth`). When `brush.showText` is set, each segment gets a
   * `round(list[j] / sum * yScale.max())` percentage label at a position from `getTextXY()` - see
   * the inline comment below for the preserved quirk that the label position reuses (reassigns)
   * the same `xy` local the row's own `axis.c(...)` projection was computed into, reading its OLD
   * `depth` value before the reassignment completes. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>
    const target = (brush.target ?? []) as string[]
    const c = this.axis.c as unknown as CAxis
    const yScale = this.axis.y as unknown as RateScaleFull

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      const group = this.chart.svg.group()
      const startX = c(index, 0).x - this.barWidth / 2
      let startY = this.zeroXY2.y
      let sum = 0
      const list: number[] = []

      for (let j = 0; j < target.length; j++) {
        const h = row[target[j]] as number
        sum += h
        list.push(h)
      }

      for (let j = 0; j < target.length; j++) {
        const value = row[target[j]]
        let xy = c(index, value)
        const top = Math.sin((this.axis.c as unknown as CScale).radian) * xy.depth
        const height = this.zeroXY2.y - yScale.rate(list[j], sum)
        const r = this.drawMain(j, this.barWidth, height, (this.axis.c as unknown as CScale).degree, xy.depth)

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        r.translate(startX, startY - height + top)
        group.append(r)

        if (brush.showText) {
          const p = Math.round((list[j] / sum) * yScale.max())
          const x = startX + this.barWidth / 2
          const y = startY - height / 2 + 6
          // **PRESERVED QUIRK**: legacy reassigns its OWN `xy` local here (`var xy =
          // this.getTextXY(j, x, y, xy.depth)`), shadowing the earlier `axis.c(...)`-derived `xy`
          // - harmless since nothing below reads the original `xy` again this iteration. Ported
          // as a genuine reassignment of the same binding (not a fresh `const`) for the identical
          // shape - `xy.depth` on the right-hand side still reads the OLD (pre-reassignment) value,
          // matching JS's own left-to-right evaluation order.
          xy = this.getTextXY(j, x, y, xy.depth) as unknown as { x: number; y: number; depth: number }

          group.append(this.drawText(p, xy.x, xy.y))
        }

        startY -= height
      }

      this.g.append(group)
    })

    return this.g
  }
}

registerBrush('fullstackcolumn3d', FullStackColumn3DBrush)
