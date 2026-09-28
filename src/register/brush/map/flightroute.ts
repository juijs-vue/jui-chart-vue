// Port of legacy `src/brush/map/flightroute.js` ("chart.brush.map.flightroute", extend:
// "chart.brush.map.core") - draws "airport" markers (small/large, per row's `airport` field) plus
// straight connector lines to each of that row's own `routes` (other row ids), with a hover
// balloon tooltip showing the row's `title`.
import { registerBrush, MapCoreBrush } from 'jui-graph-ts'
import type { BrushData, BrushOptions } from 'jui-graph-ts'

/** `chart.brush.map.flightroute` declares no `static setup()`/config fields of its own - airport
 * type/routes/title are all read per-row off the data itself (see `MapFlightRouteBrush.draw()`).
 * Re-exported as an alias for `jui-graph-ts`'s base `BrushOptions` purely so a future
 * `jui-api-doc` page for `"map.flightroute"` has a named type to point at. */
export type MapFlightRouteBrushOptions = BrushOptions

type MapScaleFn = (id: string) => { x: number; y: number; data: BrushData | null } | undefined

const SMALL_RATE = 0.4
const LARGE_RATE = 1.33
const PADDING = 7
const ANCHOR = 7
const TEXT_Y = 14

/** Draws "airport" markers (small/large concentric circles, per row's `airport` field) plus straight
 * connector lines to each of that row's own `routes` (other row ids), with a shared hover balloon
 * tooltip showing the row's `title`. Per this file's own doc on `setOverEffect()`, the hover-in
 * highlight color is the opposite of the marker's own resting color (large markers highlight with
 * the small-airport color and vice versa), matching the legacy source's quirk. Rows missing either
 * `airport` or a resolvable map position are skipped entirely. */
export class MapFlightRouteBrush extends MapCoreBrush {
  private g: any
  private tooltip: any
  private smallColor: unknown
  private largeColor: unknown
  private borderWidth: unknown
  private lineColor: unknown
  private lineWidth: unknown
  private outerSize = 0

  /** Sets the shared tooltip's text/anchor to `obj.data.title` when it's a non-empty string, and
   * returns that title (falsy for a missing/empty title) - `setOverEffect()`'s hover-in handler
   * uses the return value to decide whether to show the tooltip at all. */
  private printTooltip(obj: { data: BrushData }): unknown {
    const msg = obj.data.title

    if (typeof msg === 'string' && msg != '') {
      this.tooltip.get(1).text(msg)
      this.tooltip.get(1).attr({ 'text-anchor': 'middle' })
    }

    return msg
  }

  /** Wires hover handlers onto an airport's `outer`/`inner` circles. On hover-in, bails out via
   * `printTooltip()` when the row has no title; otherwise sizes/positions the balloon tooltip above
   * the marker (`balloonPoints('top', w, h, ANCHOR)`, inherited from `MapCoreBrush`) and recolors
   * both circles and the tooltip border. PRESERVED QUIRK: the hover-in highlight color is the
   * OPPOSITE of `type`'s own resting color (`type == 'large' ? smallColor : largeColor`, versus
   * `drawAirport()`/hover-out's `type == 'large' ? largeColor : smallColor`) - hovering a large
   * airport marker recolors it with the small-airport color and vice versa, exactly matching the
   * legacy source. On hover-out, the marker is restored to its normal `type`-matched color and the
   * tooltip is hidden. */
  private setOverEffect(type: string, xy: { x: number; y: number; data: BrushData }, outer: any, inner: any): void {
    const over = (): void => {
      if (!this.printTooltip(xy as unknown as { data: BrushData })) return

      const color = type == 'large' ? this.smallColor : this.largeColor
      const size = this.tooltip.get(1).size()
      const innerSize = this.outerSize * SMALL_RATE
      const w = size.width + PADDING * 2
      const h = size.height + PADDING

      this.tooltip.get(1).attr({ x: w / 2 })
      this.tooltip.get(0).attr({
        points: this.balloonPoints('top', w, h, ANCHOR),
        stroke: color,
      })
      this.tooltip.attr({ visibility: 'visible' })
      this.tooltip.translate(xy.x - w / 2, xy.y - h - ANCHOR - innerSize)

      outer.attr({ stroke: color })
      inner.attr({ fill: color })
    }

    const out = (): void => {
      const color = type == 'large' ? this.largeColor : this.smallColor

      this.tooltip.attr({ visibility: 'hidden' })
      outer.attr({ stroke: color })
      inner.attr({ fill: color })
    }

    outer.hover(over, out)
    inner.hover(over, out)
  }

  /** Draws one airport marker at `xy` as two concentric circles - a stroked, transparent-fill
   * `outer` ring and a solid-fill `inner` dot - both colored by `type`'s own color
   * (`largeColor`/`smallColor`) and sized off `outerSize`, with `'large'` markers additionally
   * scaled up by `LARGE_RATE` (radius and border width alike). Wires hover behavior via
   * `setOverEffect()`. */
  drawAirport(type: string, xy: { x: number; y: number }): void {
    const color = type == 'large' ? this.largeColor : this.smallColor
    const innerSize = this.outerSize * SMALL_RATE

    const outer = this.chart.svg
      .circle({
        r: type == 'large' ? this.outerSize * LARGE_RATE : this.outerSize,
        'stroke-width': type == 'large' ? (this.borderWidth as number) * LARGE_RATE : this.borderWidth,
        fill: 'transparent',
        'fill-opacity': 0,
        stroke: color,
      })
      .translate(xy.x, xy.y)

    const inner = this.chart.svg
      .circle({
        r: type == 'large' ? innerSize * LARGE_RATE : innerSize,
        'stroke-width': 0,
        fill: color,
      })
      .translate(xy.x, xy.y)

    this.g.append(outer)
    this.g.append(inner)

    this.setOverEffect(type, xy as unknown as { x: number; y: number; data: BrushData }, outer, inner)
  }

  /** Draws one straight connector line between two already-projected map points, styled with the
   * theme's `mapFlightRouteLineColor`/`mapFlightRouteLineWidth`. */
  drawRoutes(target: { x: number; y: number }, xy: { x: number; y: number }): void {
    const line = this.chart.svg.line({
      x1: xy.x,
      y1: xy.y,
      x2: target.x,
      y2: target.y,
      stroke: this.lineColor,
      'stroke-width': this.lineWidth,
    })

    this.g.append(line)
  }

  /** Creates the render group and a hidden shared tooltip group (a balloon `polygon` plus a
   * centered `text` element, reused/repositioned by `setOverEffect()` for every marker's hover
   * rather than built per-marker), and caches every `mapFlightRoute*` theme value this brush
   * reads. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.tooltip = this.chart.svg.group({ visibility: 'hidden' }, () => {
      this.chart.svg.polygon({
        fill: this.chart.theme('tooltipBackgroundColor'),
        'fill-opacity': this.chart.theme('tooltipBackgroundOpacity'),
        stroke: this.chart.theme('tooltipBorderColor'),
        'stroke-width': 2,
      })

      this.chart.text({
        'font-size': this.chart.theme('tooltipFontSize'),
        fill: this.chart.theme('tooltipFontColor'),
        y: TEXT_Y,
      })
    })

    this.smallColor = this.chart.theme('mapFlightRouteAirportSmallColor')
    this.largeColor = this.chart.theme('mapFlightRouteAirportLargeColor')
    this.borderWidth = this.chart.theme('mapFlightRouteAirportBorderWidth')
    this.outerSize = this.chart.theme('mapFlightRouteAirportRadius') as number
    this.lineColor = this.chart.theme('mapFlightRouteLineColor')
    this.lineWidth = this.chart.theme('mapFlightRouteLineWidth')
  }

  /** For every row that has both a resolvable map position (`axis.map(id)`) and a non-null
   * `airport` type, draws a connector line (`drawRoutes()`) to each of the row's own `routes`
   * (other row ids) that also resolve to a map position, then draws the row's own airport marker
   * (`drawAirport()`) on top of them. Rows missing either `airport` or a resolvable position are
   * skipped entirely (no marker, no routes). */
  draw = (): any => {
    this.eachData((d) => {
      const row = d as BrushData
      const id = this.axis.getValue(row, 'id', null) as string
      const type = this.axis.getValue(row, 'airport', null) as string | null
      const routes = (this.axis.getValue(row, 'routes', []) as string[]) ?? []
      const xy = ((this.axis as unknown as Record<string, unknown>).map as unknown as MapScaleFn)(id)

      if (type != null && xy != null) {
        for (let j = 0; j < routes.length; j++) {
          const target = ((this.axis as unknown as Record<string, unknown>).map as unknown as MapScaleFn)(routes[j])

          if (target != null) {
            this.drawRoutes(target, xy)
          }
        }

        this.drawAirport(type, xy)
      }
    })

    return this.g
  }
}

registerBrush('map.flightroute', MapFlightRouteBrush)
