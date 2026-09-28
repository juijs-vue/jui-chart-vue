// Port of the REAL legacy `chart.brush.gauge` ("chart.brush.gauge", extend: "chart.brush.donut") -
// found via `git clone https://github.com/juijs/jui-chart.git` -> the repo's own `legacy` branch
// (also present, byte-identical logic, in every `v2.0.x` tag), at `js/brush/gauge.js`. This is NOT
// on the `master` branch (where `src/brush/` only has arcgauge/bargauge/circlegauge/fullgauge) and
// NOT in the npm-published `juijs-chart@2.6.12` tarball either - but it IS present, unminified
// logic intact (just identifier-renamed), in the actual byte-identical-to-chartplay.jui.io
// `www.jui-vue.io/lib/jui/js/chart.min.js` bundle this site ships (confirmed by grepping
// `jui.define("chart.brush.gauge"` there and diffing structure against this file). So this is a
// real, authentic original - not a reverse-engineered reconstruction.
//
// Extends `DonutBrush` (confirmed from the legacy file's own `extend:` field), reusing only
// `drawDonut()` unmodified - `draw()`/`drawBefore()`/`drawUnit()` are all completely overridden
// with gauge-specific versions (`drawBefore` is an explicit empty no-op override, needed because
// otherwise `PieBrush.drawBefore` - which `DonutBrush` never overrides - would run and create an
// unused `this.g` group; the legacy source does the exact same explicit empty override).
//
// `createText()` (private helper) draws the big center value label plus min/max end-of-arc labels
// - ported verbatim, including the legacy quirk that the VALUE label uses raw `chart.svg.text()`
// (no theme-driven format helper) while the unit/min/max labels use the themed `chart.text()`
// helper, and that `unit`/`arrow` are read straight off `data`/`brush` with no `setup()` default
// (any demo that wants them just passes extra ad hoc keys, same as the legacy source allows).
import { registerBrush, mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'
import { DonutBrush } from './donut'
import type { DonutBrushOptions } from './donut'

type CAxis = (i: number) => { width: number; height: number; x: number; y: number }

/** `chart.brush.gauge`'s own config fields (on top of the inherited `DonutBrushOptions` -
 * `size` is redeclared here as the gauge arc's stroke width, same concept as `DonutBrush`'s ring
 * thickness). */
export interface GaugeBrushOptions extends Omit<DonutBrushOptions, 'size'> {
  /** Stroke width of the gauge arc in px. */
  size?: number
  /** Start angle in degrees of the gauge arc. */
  startAngle?: number
  /** End angle in degrees of the gauge arc (an angular span from `startAngle`, not an absolute
   * end - `360` draws a full circle). */
  endAngle?: number
}

/** Own `chart.brush.gauge.setup()` fields - see legacy `gauge.js`. */
export const GAUGE_BRUSH_OWN_DEFAULTS: GaugeBrushOptions = {
  size: 30,
  startAngle: 0,
  endAngle: 360,
}

/** `chart.brush.gauge`: a single-ring donut gauge, extending `DonutBrush` and reusing only its
 * unmodified `drawDonut()` - a background track ring covering the remaining span plus a
 * value-proportional foreground arc (`(value - min) / (max - min)` of `startAngle`-`endAngle`), with
 * a big center value label, an optional unit label, and min/max labels positioned at the arc's own
 * ends. See this file's own header comment for why it's ported from the legacy engine's separate
 * `legacy` branch (not present in `master`/the npm tarball) and for the preserved quirk that the
 * value label uses raw, unthemed `chart.svg.text()` while the unit/min/max labels use the themed
 * `chart.text()` helper. */
export class GaugeBrush extends DonutBrush {
  // Per-instance state written by `drawUnit()`, read by `createText()` right after (matches the
  // legacy closure-scoped `w, centerX, centerY, outerRadius, innerRadius` vars, which `createText`
  // itself doesn't need directly - only `centerX`/`centerY`/`outerRadius` are actually read inside
  // `createText`, but all five are kept as fields for fidelity with the original's own variable set).
  private gW = 0
  private gCenterX = 0
  private gCenterY = 0
  private gOuterRadius = 0
  private gInnerRadius = 0

  /** Draws the gauge's text overlay: the big center `value` label (positioned lower, at `y: 70`,
   * when `brush.arrow` is truthy, to leave room for an arrow needle above it - via raw
   * `chart.svg.text()`, unthemed, per this file's header comment), an optional `unit` label below
   * it (skipped when `unit === ''`), and `min`/`max` labels positioned at the arc's own start/end
   * points (`mathUtil.rotate()` at `startAngle`/`endAngle` from the top of the gauge, offset
   * inward by a fixed 30/20px so they sit just inside the arc's ends). `unit`/`brush.arrow` have no
   * `setup()` default - they're read straight off the row/brush options with no declared default,
   * same as the legacy source. */
  private createText(startAngle: number, endAngle: number, min: unknown, max: unknown, value: unknown, unit: unknown): any {
    const g = this.chart.svg.group({ class: 'gauge text' }).translate(this.gCenterX, this.gCenterY)

    g.append(
      this.chart.svg.text(
        {
          x: 0,
          y: (this.brush as Record<string, unknown>).arrow ? 70 : 10,
          'text-anchor': 'middle',
          'font-size': '3em',
          'font-weight': 1000,
          fill: this.color(0),
        },
        value + '',
      ),
    )

    if (unit != '') {
      g.append(
        this.chart.text(
          {
            x: 0,
            y: 100,
            'text-anchor': 'middle',
            'font-size': '1.5em',
            'font-weight': 500,
            fill: this.chart.theme('gaugeFontColor'),
          },
          unit as string,
        ),
      )
    }

    // 바깥 지름 부터 그림 (start from the outer diameter)
    let startX = 0
    let startY = -this.gOuterRadius

    // min
    let obj = mathUtil.rotate(startX, startY, mathUtil.radian(startAngle))
    startX = obj.x
    startY = obj.y

    g.append(
      this.chart.text(
        {
          x: obj.x + 30,
          y: obj.y + 20,
          'text-anchor': 'middle',
          fill: this.chart.theme('gaugeFontColor'),
        },
        min + '',
      ),
    )

    // max - outer arc 에 대한 지점 설정 (position on the outer arc)
    obj = mathUtil.rotate(startX, startY, mathUtil.radian(endAngle))

    g.append(
      this.chart.text(
        {
          x: obj.x - 20,
          y: obj.y + 20,
          'text-anchor': 'middle',
          fill: this.chart.theme('gaugeFontColor'),
        },
        max + '',
      ),
    )

    return g
  }

  /** Explicit empty no-op override, needed to stop the inherited `PieBrush.drawBefore()` (which
   * `DonutBrush` never overrides) from running and creating an unused group - matching the legacy
   * source's own explicit empty override for the same reason. */
  drawBefore = (): void => {}

  /**
   * Overrides `DonutBrush.drawUnit()` (a different signature too - `(index, data, group)`, drawing
   * directly into a caller-supplied `group` rather than the inherited `(index, data, g)` shape)
   * with the gauge-specific rendering: a value-proportional foreground arc
   * (`currentAngle = endAngle * rate`, `rate = (value - min) / (max - min)`, clamped to at most
   * `endAngle`) drawn via the inherited `drawDonut()` with `color(index)`, plus a background track
   * ring covering the remaining span (`startAngle + currentAngle` to `endAngle - currentAngle`),
   * drawn first so the value arc renders on top. `endAngle` is clamped to 359.99999° when
   * configured as a full circle (`>= 360`), matching `drawDonut()`'s own "can't close a literal
   * 360° arc" fix. Finishes with `createText()`'s value/unit/min/max labels.
   */
  drawUnit(index: number, data: unknown, group: any): any {
    const row = data as BrushData
    const obj = (this.axis.c as unknown as CAxis)(index)
    const value = this.getValue(row, 'value', 0) as number
    const max = this.getValue(row, 'max', 100) as number
    const min = this.getValue(row, 'min', 0) as number
    const unit = this.getValue(row, 'unit')

    const brush = this.brush as Record<string, unknown>
    const startAngle = brush.startAngle as number
    let endAngle = brush.endAngle as number

    if (endAngle >= 360) {
      endAngle = 359.99999
    }

    const rate = (value - min) / (max - min)
    let currentAngle = endAngle * rate

    if (currentAngle > endAngle) {
      currentAngle = endAngle
    }

    const width = obj.width
    const height = obj.height
    const x = obj.x
    const y = obj.y

    // center
    this.gW = Math.min(width, height) / 2
    this.gCenterX = width / 2 + x
    this.gCenterY = height / 2 + y
    this.gOuterRadius = this.gW - (brush.size as number) / 2
    this.gInnerRadius = this.gOuterRadius - (brush.size as number)

    group.append(
      this.drawDonut(this.gCenterX, this.gCenterY, this.gInnerRadius, this.gOuterRadius, startAngle + currentAngle, endAngle - currentAngle, {
        fill: 'transparent',
        stroke: this.chart.theme('gaugeBackgroundColor'),
      }),
    )

    group.append(
      this.drawDonut(this.gCenterX, this.gCenterY, this.gInnerRadius, this.gOuterRadius, startAngle, currentAngle, {
        fill: 'transparent',
        stroke: this.color(index),
      }),
    )

    // startAngle, endAngle 에 따른 Text 위치를 선정해야함 (text position depends on start/end angle)
    group.append(this.createText(startAngle, endAngle, min, max, value, unit))

    return group
  }

  /** Creates the shared group and delegates to `drawUnit()` once per data row (there is normally
   * just one row, since the gauge area is shared/non-repeating - same convention as
   * `ArcGaugeBrush.draw()`/`FullGaugeBrush.draw()`). */
  draw = (): any => {
    const group = this.chart.svg.group()

    this.eachData((data, i) => {
      this.drawUnit(i as number, data, group)
    })

    return group
  }

  /** Returns this brush's own default options (`size`/`startAngle`/`endAngle`), merged by
   * `defineOptions()` on top of the inherited `DonutBrush`/`PieBrush`/`CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return GAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('gauge', GaugeBrush)
