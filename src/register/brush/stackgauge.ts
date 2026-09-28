// Port of the REAL legacy `chart.brush.stackgauge` ("chart.brush.stackgauge", extend:
// "chart.brush.donut") - found via `git clone https://github.com/juijs/jui-chart.git` -> the
// repo's own `legacy` branch (also present in every `v2.0.x` tag), at `js/brush/stackgauge.js`.
// Not on `master`, not in the npm-published `juijs-chart@2.6.12` tarball - but confirmed
// byte-identical logic (identifier-renamed) in `www.jui-vue.io/lib/jui/js/chart.min.js`
// (`jui.define("chart.brush.stackgauge",...)`), itself confirmed byte-identical to
// `chartplay.jui.io/lib/jui/js/chart.min.js` via `md5sum`. A real, authentic original - not a
// reverse-engineered reconstruction.
//
// Extends `DonutBrush` (confirmed from the legacy file's own `extend:` field), reusing only
// `drawDonut()` unmodified - `draw()`/`drawBefore()` are both completely overridden. Draws
// concentric partial-ring "stacked" gauges, one per data row, each ring's radius shrinking inward
// by `brush.size` from the previous (`outerRadius -= brush.size` at the end of each iteration - a
// real, intentional mutation of shared per-instance state across `eachData()` iterations, not a
// bug - kept as a private field here for the same reason).
//
// `drawBefore`'s own `if (!axis.c) { axis.c = function() {...} }` fallback (synthesizing a
// full-chart-area panel when no `c`-type axis panel is configured, which is exactly the situation
// every real `stack_gauge` demo is in) is ported verbatim - see `fillgauge.ts`'s header comment
// for why the *sibling* brush needed this same fallback added by hand (it was missing there, but
// is genuinely present here in the original).
import { registerBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { DonutBrush } from './donut'
import type { DonutBrushOptions } from './donut'

type CAxis = () => { width: number; height: number; x: number; y: number }

/** `chart.brush.stackgauge`'s own config fields (on top of the inherited `DonutBrushOptions` -
 * `size` is redeclared here since it means "each concentric ring's bar thickness" rather than
 * `DonutBrush`'s single-ring thickness, though the same underlying concept). */
export interface StackGaugeBrushOptions extends Omit<DonutBrushOptions, 'size'> {
  /** Minimum value of the gauge's scale. */
  min?: number
  /** Maximum value of the gauge's scale. */
  max?: number
  /** Spacing in px between adjacent concentric rings. */
  cut?: number
  /** Each concentric ring's bar thickness in px (also the amount the next ring's radius shrinks
   * by). */
  size?: number
  /** Start angle in degrees of each ring's arc. */
  startAngle?: number
  /** End angle in degrees of each ring's arc (an angular span, not an absolute end - `360` draws
   * a full circle from `startAngle`). */
  endAngle?: number
  /** Data key whose value is shown as each ring's title/label. */
  title?: string
}

/** Own `chart.brush.stackgauge.setup()` fields - see legacy `stackgauge.js`. */
export const STACKGAUGE_BRUSH_OWN_DEFAULTS: StackGaugeBrushOptions = {
  min: 0,
  max: 100,
  cut: 5,
  size: 24,
  startAngle: -180,
  endAngle: 360,
  title: 'title',
}

export class StackGaugeBrush extends DonutBrush {
  private sgW = 0
  private sgCenterX = 0
  private sgCenterY = 0
  private sgOuterRadius = 0

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. When no
   * `c`-type axis panel is configured (the normal situation for a `stack_gauge` demo - see header
   * comment), synthesizes a fallback `axis.c` spanning the whole chart area. Derives the shared
   * gauge center (`sgCenterX`/`sgCenterY`) and starting outer radius (`sgOuterRadius`, reset to
   * `sgW` on every draw) from that panel's rect - the smaller of its width/height halved, so the
   * outermost ring always fits inscribed. */
  drawBefore = (): void => {
    if (!this.axis.c) {
      ;(this.axis as unknown as { c: CAxis }).c = () => ({
        x: 0,
        y: 0,
        width: this.chart.area('width') as number,
        height: this.chart.area('height') as number,
      })
    }

    const obj = (this.axis.c as unknown as CAxis)()
    const width = obj.width
    const height = obj.height
    const x = obj.x
    const y = obj.y
    let min = width

    if (height < min) {
      min = height
    }

    this.sgW = min / 2
    this.sgCenterX = width / 2 + x
    this.sgCenterY = height / 2 + y
    this.sgOuterRadius = this.sgW
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Draws one
   * concentric partial-ring gauge per data row, via the inherited `DonutBrush.drawDonut()`: an
   * "empty" background arc for the unfilled portion plus a colored arc for the filled portion
   * (`rate = (value - min) / (max - min)` of `endAngle`), and a title label read from
   * `row[brush.title]`. A configured `endAngle >= 360` is clamped down to `359.99999` (both on
   * the local variable AND mutated back onto `brush.endAngle` itself, so this clamp only ever
   * happens once - subsequent rows in the same draw, and subsequent draws, see the already-clamped
   * value) since a true 360-degree ring can't be drawn as a distinguishable open arc. After each
   * row, shrinks `sgOuterRadius` by `size` so the next row's ring nests inside this one - genuine,
   * intentional mutation of shared per-instance state across `eachData()` iterations (see header
   * comment), not a bug. */
  draw = (): any => {
    const group = this.chart.svg.group()
    const brush = this.brush as Record<string, unknown>

    this.eachData((data, i) => {
      const row = data as BrushData
      const target = brush.target as string
      const min = brush.min as number
      const max = brush.max as number
      const size = brush.size as number
      const cut = brush.cut as number
      const startAngle = brush.startAngle as number

      const rate = ((row[target] as number) - min) / (max - min)
      let endAngle = brush.endAngle as number
      const currentAngle = endAngle * rate
      const innerRadius = this.sgOuterRadius - size + cut

      if (endAngle >= 360) {
        brush.endAngle = 359.99999
        endAngle = 359.99999
      }

      // 빈 공간 그리기 (draw the empty portion)
      let g = this.drawDonut(this.sgCenterX, this.sgCenterY, innerRadius, this.sgOuterRadius, startAngle + currentAngle, endAngle - currentAngle, {
        fill: this.chart.theme('gaugeBackgroundColor'),
      })

      group.append(g)

      // 채워진 공간 그리기 (draw the filled portion)
      g = this.drawDonut(this.sgCenterX, this.sgCenterY, innerRadius, this.sgOuterRadius, startAngle, currentAngle, {
        fill: this.color(i as number),
      })

      group.append(g)

      // draw text
      group.append(
        this.chart.text(
          {
            x: this.sgCenterX + 2,
            y: this.sgCenterY + Math.abs(this.sgOuterRadius) - 5,
            fill: this.color(i as number),
            'font-size': '12px',
            'font-weight': 'bold',
          },
          (row[brush.title as string] as string) || '',
        ),
      )

      this.sgOuterRadius -= size
    })

    return group
  }

  /** Returns this brush's own config defaults (`STACKGAUGE_BRUSH_OWN_DEFAULTS`); `builder.ts`'s
   * `defineOptions()` still layers `DonutBrush`'s own defaults underneath. */
  static setup(): Record<string, unknown> {
    return STACKGAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('stackgauge', StackGaugeBrush)
