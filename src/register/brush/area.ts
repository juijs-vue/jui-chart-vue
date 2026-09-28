// Port of legacy `src/brush/area.js` ("chart.brush.area", extend: "chart.brush.line"). Reuses
// `LineBrush`'s `createLine`/`addLineElement`/`createTooltip`/`curvePoints` etc via real TS class
// inheritance; only `draw`/`drawAnimate` are overridden (matching legacy area.js's own scope -
// `drawBefore` is inherited unchanged from `LineBrush`).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushSeriesXY } from 'jui-graph-ts'
import { LineBrush } from './line'
import type { LineBrushOptions } from './line'

/** `chart.brush.area`'s own config fields. Note this legacy file's own `setup()` does NOT
 * include `opacity` (unlike `LineBrush.setup()`) - `jui-graph-ts`'s `defineOptions()` now walks
 * the full `AreaBrush -> LineBrush -> CoreBrush -> Draw` static `setup()` chain itself, so
 * `opacity` (from `LineBrush.setup()`) and `CoreBrush`/`Draw`'s own defaults all merge in
 * automatically - `opacity` (inherited) still controls the area FILL's opacity here (read via
 * `getOpacity()`/`drawArea()`'s own `opacityOpt` handling), not just a line's stroke. */
export interface AreaBrushOptions extends Omit<LineBrushOptions, 'display'> {
  symbol?: 'normal' | 'curve' | 'step'
  active?: number | string | string[] | null
  activeEvent?: string | null
  /** Which points get a permanent min/max value tooltip on the area's own boundary line; `null`
   * shows none by default (`AreaBrush` never supports `'all'`, unlike `LineBrush`). */
  display?: 'max' | 'min' | null
  /** Fills from the axis's zero line (`true`) or from its minimum value (`false`) - only matters
   * when the domain doesn't include zero. */
  startZero?: boolean
  /** Draws a visible boundary line on top of the filled area; `false` renders the fill only. */
  line?: boolean
}

/** Own `chart.brush.area.setup()` fields - see legacy `area.js`. Note this legacy file's own
 * `setup()` does NOT include `opacity` (unlike `LineBrush.setup()`) - `jui-graph-ts`'s
 * `defineOptions()` now walks the full `AreaBrush -> LineBrush -> CoreBrush -> Draw` static
 * `setup()` chain itself, so `opacity` (from `LineBrush.setup()`) and `CoreBrush`/`Draw`'s own
 * defaults all merge in automatically - this only needs `AreaBrush`'s own leaf-level fields. */
export const AREA_BRUSH_OWN_DEFAULTS: AreaBrushOptions = {
  symbol: 'normal',
  active: null,
  activeEvent: null,
  display: null,
  startZero: true,
  line: true,
}

/** `chart.brush.area`: draws a filled area under each target's line series, extending `LineBrush`
 * and reusing its line-building/tooltip machinery unchanged while overriding `draw()` to close each
 * line segment down to a baseline (the zero line when `startZero`, otherwise the axis minimum) and
 * fill it at the line's own (or theme) opacity. When `brush.line` is enabled, a plain boundary line
 * is drawn on top of the fill and wired up for hover/tooltip interaction the same way `LineBrush`
 * does. */
export class AreaBrush extends LineBrush {
  /** Builds one target's filled area, and (per-target) all targets' groups. For each target `k`,
   * takes `createLine()`'s line segments (its `children` - a series can be split into several
   * disconnected segments) and closes each one individually into a filled polygon by drawing back
   * down to the baseline y (`0` when `startZero`, else the axis's minimum value) and back to its
   * own start x, then fills it with that segment's own stroke color at `fill-opacity` (a fixed
   * `brush.opacity` number, a per-segment value read back off the just-drawn line's own
   * `stroke-opacity` when `opacity` is a function, or the theme's `areaBackgroundOpacity`
   * otherwise) and zeroes the stroke width so only the fill shows. When `brush.line` is truthy, a
   * second, undecorated line is drawn on top as the visible boundary and wired up via
   * `addLineElement()` (hover behavior) and, when `brush.display` requests it, `createTooltip()`
   * (permanent min/max markers). Each target's whole group also gets its own click/hover events via
   * `addEvent(g, undefined, k)`. */
  drawArea(path: BrushSeriesXY[]): any {
    const g = this.chart.svg.group()
    const startZero = (this.brush as Record<string, unknown>).startZero
    const y = (this.axis.y as BrushAxisScale)(startZero ? 0 : (this.axis.y as BrushAxisScale & { min(): number }).min())
    const opacityOpt = (this.brush as Record<string, unknown>).opacity
    let opacity: unknown = typeof opacityOpt === 'number' ? opacityOpt : this.chart.theme('areaBackgroundOpacity')

    for (let k = 0; k < path.length; k++) {
      const children = this.createLine(path[k], k).children

      for (let i = 0; i < children.length; i++) {
        const p = children[i]

        if (typeof opacityOpt === 'function') {
          opacity = p.attr('stroke-opacity')
        }

        if (path[k].length > 0) {
          p.LineTo(p.attr('x2'), y)
          p.LineTo(p.attr('x1'), y)
          p.ClosePath()
        }

        p.attr({
          fill: p.attr('stroke'),
          'fill-opacity': opacity,
          'stroke-width': 0,
        })

        g.prepend(p)
      }

      if ((this.brush as Record<string, unknown>).line) {
        const p = this.createLine(path[k], k)
        g.prepend(p)

        this.addLineElement({ element: p, tooltip: null })

        if ((this.brush as Record<string, unknown>).display) {
          this.createTooltip(g, path[k], k)
        }
      }

      this.addEvent(g, undefined, k)
    }

    return g
  }

  /** Overrides `LineBrush.draw()`: renders filled areas via `drawArea()` instead of plain
   * boundary lines, from the same `getXY()` coordinates `LineBrush.draw()` itself uses. */
  draw = (): any => {
    return this.drawArea(this.getXY())
  }

  /** Fades the whole rendered area group in from `opacity: 0` to `1` over 1.5s on initial render. */
  drawAnimate = (root: any): void => {
    root.append(
      this.chart.svg.animate({
        attributeName: 'opacity',
        from: '0',
        to: '1',
        begin: '0s',
        dur: '1.5s',
        repeatCount: '1',
        fill: 'freeze',
      }),
    )
  }

  static setup(): Record<string, unknown> {
    return AREA_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('area', AreaBrush)
