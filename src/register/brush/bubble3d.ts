// Port of legacy `src/brush/bubble3d.js` ("chart.brush.bubble3d", extend: "chart.brush.bubble") -
// extends `BubbleBrush` (confirmed from the legacy file's own `extend:` field), reusing its
// inherited `createBubble()` unchanged but completely overriding `draw()` with its own "grid3d"-
// axis-positioned (`axis.c(index, value, targetIndex, targetCount)`) radial-gradient-shaded
// variant, scaling each bubble's radius down as its target index recedes "back" in the cluster
// (`mathUtil.scaleValue(count-j, 1, count, 0.6, 1)`) for a pseudo-depth-of-field effect.
import { registerBrush, mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { BubbleBrush } from './bubble'
import type { BubbleBrushOptions } from './bubble'

/** `chart.brush.bubble3d` has no `setup()` of its own - it inherits `BubbleBrush`'s options
 * verbatim. Re-exported under this name purely so a generated doc page for `"bubble3d"` has
 * something to point at. */
export type Bubble3DBrushOptions = BubbleBrushOptions

type CAxis = (i: unknown, v: unknown, j: unknown, count: unknown) => { x: number; y: number; depth: number }
type CScale = { radian: number; degree: unknown }

export class Bubble3DBrush extends BubbleBrush {
  /** Builds a radial-gradient fill (white center fading to this bubble's own `color(i, j)`) whose
   * focal point (`dx`/`dy`, as percentages) is offset according to the "grid3d" axis's current
   * rotation `degree`, so the highlight appears to come from a consistent light direction across
   * the whole 3D scene. Returns `color(i, j)` unchanged if it's already a radial-gradient color
   * string (avoids double-wrapping an already-3D-shaded color). */
  getRadialGradient(i: number, j: number): string {
    let color = this.color(i, j)
    const degree = (this.axis.c as unknown as CScale).degree as number
    const dxRate = 40 / 45
    const dyRate = 80 / 90
    const dx = 50 + dxRate * (degree >= 45 ? Math.abs(degree - 90) : degree)
    const dy = 10 + dyRate * (90 - degree)

    if (color.indexOf('radial') == -1) {
      return this.chart.color(`radial(${dx}%,${dy}%,50%,${dx}%,${dy}%) 0% #FFFFFF,50% ${color}`) as string
    }

    return color
  }

  /** Overrides `BubbleBrush.draw()` for the "grid3d" axis: each row/target's position comes from
   * `axis.c(index, value, j, count)`'s isometric projection rather than plain `getXY()`, shifted by
   * half the projection's own depth offset (`dx`/`dy`, from `cos`/`sin` of the axis's rotation
   * `radian`) so the bubble centers on its projected cell. Each bubble is built via the inherited
   * `createBubble()` (radius/text unchanged) and then post-adjusted: its circle radius is scaled by
   * `mathUtil.scaleValue(count - j, 1, count, 0.6, 1)` (targets further "back" in the cluster, i.e.
   * higher `j`, shrink toward 60% of their base radius) and its fill replaced with
   * `getRadialGradient()`'s pseudo-3D shading. */
  draw = (): any => {
    const g = this.chart.svg.group()
    const target = ((this.brush as Record<string, unknown>).target ?? []) as string[]
    const count = target.length
    const c = this.axis.c as unknown as CAxis

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number

      for (let j = 0; j < count; j++) {
        const value = row[target[j]]
        const xy = c(index, value, j, count)
        const dx = Math.cos((this.axis.c as unknown as CScale).radian) * xy.depth
        const dy = Math.sin((this.axis.c as unknown as CScale).radian) * xy.depth
        const startX = xy.x + dx / 2
        const startY = xy.y - dy / 2
        const rate = mathUtil.scaleValue(count - j, 1, count, 0.6, 1)
        const color = this.color(index, j)

        // Legacy calls `this.createBubble({...}, color)` with only 2 args too (`dataIndex` is
        // required by this project's own `BubbleBrush.createBubble()` TS signature, but only
        // matters when `brush.scaleKey` is configured) - passed through as `undefined` here for
        // literal fidelity, not `index`.
        const b = this.createBubble({ x: startX, y: startY, value }, color, undefined as unknown as number)
        const c0 = b.get(0)

        c0.attr({
          r: (c0.attributes.r as number) * rate,
          fill: this.getRadialGradient(index, j),
        })

        this.addEvent(b, index, j)
        g.append(b)
      }
    })

    return g
  }
}

registerBrush('bubble3d', Bubble3DBrush)
