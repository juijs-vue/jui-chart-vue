// Port of legacy `src/brush/hudcolumn.js` ("chart.brush.hudcolumn", extend: "chart.brush.core") -
// a "HUD-style" vertical left/right range-column brush: two overlapping angled "flag" polygons per
// row (`createColumn()`), plus its own bottom grid (domain labels + a hover-revealed inner marker
// dot + transparent hit-test outlines) drawn independently of the axis's own grid lines.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.hudcolumn`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface HUDColumnBrushOptions {
  /** Padding reserved at the left/right of each row's HUD column group. */
  outerPadding?: number
  /** Gap in px between adjacent columns within the same row. */
  innerPadding?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `hudcolumn.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.hudcolumn.setup()` fields - see legacy `hudcolumn.js`. */
export const HUDCOLUMN_BRUSH_OWN_DEFAULTS: HUDColumnBrushOptions = {
  outerPadding: 5,
  innerPadding: 5,
  clip: false,
}

/** `chart.brush.hudcolumn`: the vertical counterpart to `HUDBarBrush` - draws two overlapping
 * angled "flag" polygons per row (`createColumn()`, for `left`/`right` values), each slanting toward
 * the zero baseline and hidden when too short to reach it. Also draws its own bottom grid
 * (`drawGrid()`), independent of the axis's own grid lines: an axis line, per-domain outer/inner
 * marker dots (the inner dot revealed on hover), a domain label, and a transparent larger hit-test
 * outline pair for hover/click. */
export class HUDColumnBrush extends CoreBrush {
  private g: any
  private domains: unknown[] = []
  private zeroY = 0
  private width = 0
  private colWidth = 0
  private halfWidth = 0
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  /** Arrow-function class field overriding `Draw`'s optional `drawBefore` lifecycle hook. Caches
   * the zero baseline (`zeroY`), the x-axis row band width, and the plot area's four edges
   * (`x1`/`x2`/`y1`/`y2`), and derives each of the two HUD columns' width (`colWidth`, split
   * evenly across `outerPadding`/`innerPadding`, floored at `0` if the padding leaves no room). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const op = brush.outerPadding as number
    const ip = brush.innerPadding as number
    const len = 2

    this.g = this.chart.svg.group()
    this.zeroY = (this.axis.y as BrushAxisScale)(0)
    this.width = (this.axis.x as BrushAxisScale).rangeBand!()
    this.domains = (this.axis.x as unknown as { domain(): unknown[] }).domain()

    this.halfWidth = this.width - op * 2
    this.colWidth = (this.width - op * 2 - (len - 1) * ip) / len
    this.colWidth = this.colWidth < 0 ? 0 : this.colWidth

    this.x1 = this.axis.area('x')
    this.x2 = this.axis.area('x2')
    this.y1 = this.axis.area('y')
    this.y2 = this.axis.area('y2')
  }

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. Draws two
   * angled "flag" polygons per row (via `createColumn()`) - one for `left`, one for `right` -
   * colored with `hudColumnLeftBackgroundColor`/`hudColumnRightBackgroundColor`, then appends the
   * brush's own bottom grid (`drawGrid()`) and returns the group. */
  draw = (): any => {
    const data = this.axis.data as BrushData[]

    for (let i = 0; i < data.length; i++) {
      const left = this.getValue(data[i], 'left', 0) as number
      const right = this.getValue(data[i], 'right', 0) as number
      let moveX = (this.axis.x as BrushAxisScale)(i) - this.halfWidth / 2

      for (let j = 0; j < 2; j++) {
        const moveY = (this.axis.y as BrushAxisScale)(j == 0 ? left : right)

        const rect = this.createColumn(
          j,
          { fill: j == 0 ? this.chart.theme('hudColumnLeftBackgroundColor') : this.chart.theme('hudColumnRightBackgroundColor') },
          moveX,
          moveY,
        )

        this.g.append(rect)
        moveX += this.colWidth + ((this.brush as Record<string, unknown>).innerPadding as number)
      }
    }

    this.drawGrid()

    return this.g
  }

  /** Draws the brush's own bottom axis line, plus per-domain grid points: an outer circle
   * (`point1`, themed with the axis background), an inner dot (`point2`, hidden until hovered),
   * and a domain label below it. Also draws a transparent, `stroke`-only pair of `createColumn()`
   * outlines per domain purely as a larger hover/click hit-test target (wired via `addEvent`),
   * grouped so hovering either outline reveals that domain's `point2` inner dot. */
  private drawGrid(): void {
    const r = this.chart.theme('hudColumnGridPointRadius') as number
    const stroke = this.chart.theme('hudColumnGridPointBorderColor')
    const width = this.chart.theme('hudColumnGridPointBorderWidth')

    this.g.append(
      this.svg.line({
        stroke,
        'stroke-width': width,
        x1: this.x1,
        x2: this.x2,
        y1: this.y2,
        y2: this.y2,
      }),
    )

    for (let i = 0; i < this.domains.length; i++) {
      const domain = this.domains[i]
      const move = (this.axis.x as BrushAxisScale)(i)
      let moveX = move - this.halfWidth / 2

      const point1 = this.svg.circle({
        r,
        fill: this.chart.theme('axisBackgroundColor'),
        stroke,
        'stroke-width': width,
        cx: move,
        cy: this.y2,
      })

      const point2 = this.svg.circle({
        r: r * 0.65,
        fill: stroke,
        'stroke-width': 0,
        cx: move,
        cy: this.y2,
        'fill-opacity': 0,
      })

      const text = this.chart.text(
        {
          x: move,
          y: this.y2,
          dy: (this.chart.theme('hudColumnGridFontSize') as number) * 2,
          fill: this.chart.theme('hudColumnGridFontColor'),
          'text-anchor': 'middle',
          'font-size': this.chart.theme('hudColumnGridFontSize'),
          'font-weight': this.chart.theme('hudColumnGridFontWeight'),
        },
        String(domain),
      )

      const group = this.svg.group()

      for (let j = 0; j < 2; j++) {
        const rect = this.createColumn(j, { fill: 'transparent', stroke, 'stroke-width': 2 }, moveX, this.y1)

        this.addEvent(rect, i, null)
        group.append(rect)

        moveX += this.colWidth + ((this.brush as Record<string, unknown>).innerPadding as number)
      }

      group.hover(
        () => {
          point2.attr({ 'fill-opacity': 1 })
        },
        () => {
          point2.attr({ 'fill-opacity': 0 })
        },
      )

      this.g.append(group)
      this.g.append(point1)
      this.g.append(point2)
      this.g.append(text)
    }
  }

  /** Builds one HUD "flag" polygon: a quadrilateral running from `(moveX, moveY)` across to
   * `(moveX + colWidth, moveY)`, then down to a bottom edge that's slanted in opposite directions
   * for `type === 0` (left column, slants down-right) vs. any other `type` (right column, slants
   * down-left) - `padding`/`dist` control how far short of/past `y2` that bottom edge sits. The
   * polygon is hidden (`visibility: 'hidden'`) whenever its top (`moveY`) would sit at or below
   * `zeroY - dist`, i.e. whenever the flag would be too short to clear the zero baseline. */
  private createColumn(type: number, attr: Record<string, unknown>, moveX: number, moveY: number): any {
    const padding = 20
    const dist = 15 + padding
    const rect = this.svg.polygon(attr)

    rect.point(moveX, moveY)
    rect.point(moveX + this.colWidth, moveY)

    if (type == 0) {
      rect.point(moveX + this.colWidth, this.y2 - padding)
      rect.point(moveX, this.y2 - dist)
    } else {
      rect.point(moveX + this.colWidth, this.y2 - dist)
      rect.point(moveX, this.y2 - padding)
    }

    if (moveY >= this.zeroY - dist) {
      rect.attr({ visibility: 'hidden' })
    }

    return rect
  }

  /** Returns this brush's own config defaults (`HUDCOLUMN_BRUSH_OWN_DEFAULTS`) for
   * `builder.ts`'s `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return HUDCOLUMN_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('hudcolumn', HUDColumnBrush)
