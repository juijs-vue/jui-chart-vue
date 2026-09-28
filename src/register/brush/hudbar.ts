// Port of legacy `src/brush/hudbar.js` ("chart.brush.hudbar", extend: "chart.brush.core") - a
// "HUD-style" horizontal top/bottom range-bar brush with its own side grid (domain labels +
// connector lines + a shaded polygon "funnel" per row), drawn independently of the axis's own
// x/y grid lines.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.hudbar`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface HUDBarBrushOptions {
  /** Padding reserved at the top/bottom of each row's HUD bar group. */
  outerPadding?: number
  /** Gap in px between adjacent bars within the same row. */
  innerPadding?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `hudbar.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
  /** Formats the value shown in the HUD's domain labels; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.hudbar.setup()` fields - see legacy `hudbar.js`. */
export const HUDBAR_BRUSH_OWN_DEFAULTS: HUDBarBrushOptions = {
  outerPadding: 7,
  innerPadding: 7,
  clip: false,
  format: null,
}

export class HUDBarBrush extends CoreBrush {
  private g: any
  private domains: unknown[] = []
  private zeroX = 0
  private height = 0
  private colHeight = 0
  private halfHeight = 0
  private x1 = 0
  // `x2`/`y1`/`y2` (legacy's own `var x1, x2, y1, y2;` closure) are all computed in
  // `drawBefore()` too, but only `x1` is EVER read again (inside `drawGrid()`) - confirmed by
  // reading `hudbar.js` in full, unlike `hudcolumn.ts`'s own `x1`/`x2`/`y1`/`y2`, which all really
  // are used. Dropped here rather than kept as dead private fields (which this project's TS
  // config flags as unused), matching this project's existing "confirmed-dead-in-legacy" field-
  // omission convention (e.g. `equalizercolumn.ts`'s own `zeroY`).

  /** Computes this render pass's shared geometry: `zeroX` (the x pixel position of value `0`,
   * nudged right by `innerPadding`, where every top/bottom bar starts from), `height` (the y-axis
   * row band from `rangeBand()`), `domains` (the y-axis's category labels, for `drawGrid()`'s side
   * labels), `halfHeight` (the row height minus `outerPadding` on each side), `colHeight` (half of
   * `halfHeight` minus one `innerPadding` gap between the top/bottom bars, clamped to `0`), and
   * `x1` (the plot area's left edge, where `drawGrid()`'s side grid attaches). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const op = brush.outerPadding as number
    const ip = brush.innerPadding as number
    const len = 2

    this.g = this.chart.svg.group()
    this.zeroX = (this.axis.x as BrushAxisScale)(0) + ip
    this.height = (this.axis.y as BrushAxisScale).rangeBand!()
    this.domains = (this.axis.y as unknown as { domain(): unknown[] }).domain()

    this.halfHeight = this.height - op * 2
    this.colHeight = (this.height - op * 2 - (len - 1) * ip) / len
    this.colHeight = this.colHeight < 0 ? 0 : this.colHeight

    this.x1 = this.axis.area('x')
  }

  /** Draws each row's top and bottom range bars (both anchored at the shared `zeroX`, extending to
   * their own `top`/`bottom` value's pixel position, stacked within the row using `drawBefore()`'s
   * `colHeight`), plus a connector line and value label reading out from each bar's outer end. After
   * every row is drawn, appends the independent side grid via `drawGrid()`. */
  draw = (): any => {
    const data = this.axis.data as BrushData[]
    const padding = (this.brush as Record<string, unknown>).innerPadding as number
    const linePadding = this.chart.theme('hudBarTextLinePadding') as number

    for (let i = 0; i < data.length; i++) {
      const top = this.getValue(data[i], 'top', 0) as number
      const bottom = this.getValue(data[i], 'bottom', 0) as number
      let moveY = (this.axis.y as BrushAxisScale)(i) - this.halfHeight / 2 + padding / 2

      for (let j = 0; j < 2; j++) {
        const moveX = (this.axis.x as BrushAxisScale)(j == 0 ? top : bottom)
        const width = moveX - this.zeroX

        const rect = this.svg.rect({
          fill: this.chart.theme(j == 0 ? 'hudBarTopBackgroundColor' : 'hudBarBottomBackgroundColor'),
          'fill-opacity': this.chart.theme('hudBarBackgroundOpacity'),
          width,
          height: this.colHeight - padding / 2,
          x: this.zeroX,
          y: moveY,
        })

        const path = this.svg.path({
          stroke: this.chart.theme('hudBarTextLineColor'),
          'stroke-width': this.chart.theme('hudBarTextLineWidth'),
          fill: 'transparent',
        })

        const text = this.chart.text(
          {
            x: padding + width + linePadding,
            y: moveY,
            dx: 3,
            dy: this.colHeight,
            fill: this.chart.theme('hudBarTextLineFontColor'),
            'font-size': this.chart.theme('hudBarTextLineFontSize'),
          },
          String(j == 0 ? this.format(top, 'top') : this.format(bottom, 'bottom')),
        )

        path.MoveTo(padding + width, moveY + 1)
        path.LineTo(padding + width + linePadding, moveY + 1)
        path.LineTo(padding + width + linePadding, moveY + this.colHeight + 1)

        this.g.append(rect)
        this.g.append(path)
        this.g.append(text)

        this.addEvent(rect, i, null)
        moveY += this.colHeight + padding / 2
      }
    }

    this.drawGrid()

    return this.g
  }

  /** Draws the HUD's own side grid, independent of the axis's own x/y grid lines: for each y-axis
   * `domain` label, a shaded chevron/arrow-shaped polygon - full row height at the plot area's left
   * edge (`x1`), tapering through two "shoulder" points at `x1 - barWidth` to a single point at
   * `x1 - barWidth * 2` - pointing away from the plot area, plus a short connector line and the
   * domain's own text label further out at `x1 - barWidth * 3`. `barWidth` (`height / 3.5`) is a
   * fixed fraction of the row height, not configurable. */
  private drawGrid(): void {
    const barWidth = this.height / 3.5

    for (let i = 0; i < this.domains.length; i++) {
      const domain = this.domains[i]
      const move = (this.axis.y as BrushAxisScale)(i)
      const moveStart = move - this.halfHeight / 2
      const moveEnd = move + this.halfHeight / 2

      const p = this.svg.polygon({
        'stroke-width': 0,
        fill: this.chart.theme('hudBarGridBackgroundColor'),
        'fill-opacity': this.chart.theme('hudBarGridBackgroundOpacity'),
      })

      const l = this.svg.line({
        stroke: this.chart.theme('hudBarGridLineColor'),
        'stroke-width': this.chart.theme('hudBarGridLineWidth'),
        'stroke-opacity': this.chart.theme('hudBarGridLineOpacity'),
        x1: this.x1 - barWidth * 2,
        y1: move,
        x2: this.x1 - barWidth * 3,
        y2: move,
      })

      const t = this.chart.text(
        {
          x: this.x1 - barWidth * 3,
          y: move,
          dx: -7,
          dy: (this.chart.theme('hudBarGridFontSize') as number) / 3,
          fill: this.chart.theme('hudBarGridFontColor'),
          'text-anchor': 'end',
          'font-size': this.chart.theme('hudBarGridFontSize'),
          'font-weight': 'bold',
        },
        String(domain),
      )

      p.point(this.x1, moveStart)
      p.point(this.x1, moveEnd)
      p.point(this.x1 - barWidth, moveEnd)
      p.point(this.x1 - barWidth * 2, move)
      p.point(this.x1 - barWidth, moveStart)
      p.point(this.x1, moveStart)

      this.g.append(p)
      this.g.append(l)
      this.g.append(t)
    }
  }

  /** Returns this brush's own default options (`outerPadding`/`innerPadding`/`clip`/`format`),
   * merged by `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return HUDBAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('hudbar', HUDBarBrush)
