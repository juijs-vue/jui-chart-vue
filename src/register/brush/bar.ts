// Port of legacy `src/brush/bar.js` ("chart.brush.bar", extend: "chart.brush.core") onto
// `jui-graph-ts`'s real `CoreBrush`. Geometry/logic ported 1:1 from the legacy source; only the
// rendering calls move from the legacy `chart.svg.*`/closures-in-a-constructor shape to
// `this.chart.svg.*` + TS class fields/methods (`jui-graph-ts`'s `util/svg` API is confirmed
// byte-identical in shape to the legacy one - `pathRect()`/`.round()`/`.translate()` etc all match).
//
// `static setup()` below returns ONLY this brush's own legacy defaults (1:1 with `bar.js`'s own
// `setup()`) - `jui-graph-ts`'s `base/builder.ts` `defineOptions()` now walks the full
// `BarBrush -> CoreBrush -> Draw` static `setup()` chain itself (fixed upstream), so `CoreBrush`'s
// `target`/`colors`/`axis`/`index`/`clip`/`useEvent` and `Draw`'s `type`/`animate` defaults merge
// in automatically and no longer need to be duplicated here.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushSeriesXY, BrushTooltip } from 'jui-graph-ts'

interface BarStyle {
  borderColor: unknown
  borderWidth: unknown
  borderOpacity: unknown
  borderRadius: number
  disableOpacity: unknown
  circleColor: unknown
}

interface BarListItem {
  element: any
  color: string
  width: number
  height: number
  value: unknown
  tooltipX: number
  tooltipY: number
  position: string
  max: boolean
  min: boolean
  minmax?: BrushTooltip
}

/** `chart.brush.bar`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions` -
 * `target`/`colors`/`axis`/`index`/`clip`/`useEvent`/`type`). */
export interface BarBrushOptions {
  /** Fixed bar thickness in px. `0` auto-computes thickness from the available row height split
   * across `target.length` bars (see `outerPadding`/`innerPadding`). */
  size?: number
  /** Minimum rendered bar length in px, even for a value at (or near) zero - keeps very small/zero
   * values visibly clickable instead of collapsing to a sliver. */
  minSize?: number
  /** Padding reserved at the top/bottom of each row's bar group when auto-sizing (`size: 0`). */
  outerPadding?: number
  /** Gap in px between adjacent bars within the same row (also used as the vertical step between
   * multiple targets' bars). */
  innerPadding?: number
  /** Index of the bar to show a permanent (always-visible) value tooltip for, on mount. */
  active?: number | null
  /** DOM event name (e.g. `'click'`) that toggles a bar's value tooltip on/off when it fires on
   * that bar; `null` disables this per-bar toggle interaction entirely. */
  activeEvent?: string | null
  /** Which bars get a permanent min/max value tooltip: `'max'`/`'min'` shows it only on that row's
   * highest/lowest bar, `'all'` shows it on every bar, `null` shows none by default. */
  display?: 'max' | 'min' | 'all' | null
  /** Formats the value shown in a bar's tooltip; the raw value is used when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.bar.setup()` fields - see legacy `bar.js`. */
export const BAR_BRUSH_OWN_DEFAULTS: BarBrushOptions = {
  size: 0,
  minSize: 0,
  outerPadding: 2,
  innerPadding: 1,
  active: null,
  activeEvent: null,
  display: null,
  format: null,
}

/** `chart.brush.bar`: draws horizontal bars, one per target stacked vertically within each row's
 * band, extending outward from the zero x-position with an optional minimum visible length
 * (`minSize`) for near-zero values and rounded outward corners. Supports permanent min/max/all
 * value tooltips (`brush.display`), a click/hover-toggled active tooltip and dimmed-others
 * highlight (`brush.activeEvent`/`setActiveEffect()`), and a slide-in entrance animation. Shared
 * geometry/tooltip machinery (`barList`, `getBarStyle()`, `drawETC()`) is reused by `ColumnBrush`,
 * its vertical-bar sibling. */
export class BarBrush extends CoreBrush {
  protected barList: BarListItem[] = []
  protected active?: BrushTooltip

  // `protected`, not `private`: `ColumnBrush extends BarBrush` reuses `this.g` directly (its own
  // geometry fields - `zeroY`/`width`/`col_width`/`half_width` - are differently named, so only
  // `g` needs to be shared rather than shadowed; a `private` field of the same name on both
  // classes would trip TS2415 "separate declarations of a private property").
  protected g: any
  private zeroX = 0
  private height = 0
  private half_height = 0
  private bar_height = 0

  /** Reads the current theme's bar-related styling (border color/width/opacity/radius, the
   * dimmed-state opacity used by `setActiveEffect()`, and the tooltip marker's border color) into
   * one snapshot object, re-read fresh by every method that draws or restyles a bar. */
  getBarStyle(): BarStyle {
    return {
      borderColor: this.chart.theme('barBorderColor'),
      borderWidth: this.chart.theme('barBorderWidth'),
      borderOpacity: this.chart.theme('barBorderOpacity'),
      borderRadius: this.chart.theme('barBorderRadius') as number,
      disableOpacity: this.chart.theme('barDisableBackgroundOpacity'),
      circleColor: this.chart.theme('barPointBorderColor'),
    }
  }

  /** Creates one bar's `<rect>`-like path element (via `pathRect()`, styled with `getBarStyle()`'s
   * border settings and this bar's own `color()`), wires up its click/hover events (skipped when
   * the underlying value is exactly `0`, matching the legacy "zero-length bars aren't
   * interactive" behavior), and records it plus the geometry/tooltip info passed in `info` onto
   * `this.barList` so `drawETC()`/`setActiveEffect()` can look it back up later. Returns the raw
   * element so `draw()` can still round its corners and translate it into place. */
  getBarElement(dataIndex: number, targetIndex: number, info: Omit<BarListItem, 'element' | 'color'>): any {
    const style = this.getBarStyle()
    const color = this.color(dataIndex, targetIndex)
    const value = (this.getData(dataIndex) as Record<string, unknown>)[(this.brush.target ?? [])[targetIndex]]

    const r = this.chart.svg.pathRect({
      width: info.width,
      height: info.height,
      fill: color,
      stroke: style.borderColor,
      'stroke-width': style.borderWidth,
      'stroke-opacity': style.borderOpacity,
    })

    if (value != 0) {
      this.addEvent(r, dataIndex, targetIndex)
    }

    this.barList.push({ ...info, element: r, color })

    return r
  }

  /** Highlights bar `r` at full opacity while dimming every other bar in `barList` to
   * `barDisableBackgroundOpacity`, also restyling each dimmed/highlighted bar's own min/max
   * tooltip (when it has one) to match. Called on each `activeEvent` toggle (e.g. click) and once
   * up front for `brush.active`'s initial highlighted bar. */
  setActiveEffect(r: BarListItem): void {
    const style = this.getBarStyle()
    const cols = this.barList

    for (let i = 0; i < cols.length; i++) {
      const opacity = cols[i] == r ? 1 : style.disableOpacity
      cols[i].element.attr({ opacity })

      if (cols[i].minmax) {
        cols[i].minmax!.style(cols[i].color, style.circleColor, opacity)
      }
    }
  }

  /** Draws every bar's secondary decoration once all bars in `barList` exist: a shared, initially
   * hidden tooltip element (`this.active`) reused by the `activeEvent` toggle below; a permanent
   * min/max/every-bar value tooltip per bar, gated by `brush.display` (`'max'`/`'min'` only for
   * bars flagged `max`/`min`, `'all'` for every bar); a click/hover-driven tooltip toggle wired to
   * `brush.activeEvent` on every non-zero-value bar (skipped for zero-value bars, same as
   * `getBarElement()`'s own event skip, plus a `pointer` cursor); and, when `brush.active` names an
   * initial bar index, that bar's tooltip shown and highlighted immediately via
   * `setActiveEffect()`. */
  drawETC(group: any): void {
    if (!Array.isArray(this.barList)) return

    const style = this.getBarStyle()

    this.active = this.drawTooltip(undefined, undefined, undefined)
    group.append(this.active.tooltip)

    for (let i = 0; i < this.barList.length; i++) {
      const r = this.barList[i]
      const d = (this.brush as Record<string, unknown>).display

      if ((d === 'max' && r.max) || (d === 'min' && r.min) || d === 'all') {
        r.minmax = this.drawTooltip(r.color, style.circleColor, 1)
        r.minmax.control(r.position, r.tooltipX, r.tooltipY, this.format(r.value))
        group.append(r.minmax.tooltip)
      }

      if (r.value != 0 && (this.brush as Record<string, unknown>).activeEvent != null) {
        const bar = r
        this.active.style(bar.color, style.circleColor, 1)

        bar.element.on((this.brush as Record<string, unknown>).activeEvent, () => {
          this.active!.style(bar.color, style.circleColor, 1)
          this.active!.control(bar.position, bar.tooltipX, bar.tooltipY, this.format(bar.value))
          this.setActiveEffect(bar)
        })

        bar.element.attr({ cursor: 'pointer' })
      }
    }

    const active = (this.brush as Record<string, unknown>).active as number | null
    const r = active != null ? this.barList[active] : undefined
    if (r != null) {
      this.active.style(r.color, style.circleColor, 1)
      this.active.control(r.position, r.tooltipX, r.tooltipY, this.format(r.value))
      this.setActiveEffect(r)
    }
  }

  /** Computes this render pass's shared geometry: `zeroX` (the x pixel position of value `0`,
   * where every bar starts/ends from), `height` (the full row band height from the y-axis's
   * `rangeBand()`), and, per `brush.size`, either a fixed `bar_height` (with `half_height` the
   * total span of all targets' bars stacked with `innerPadding` gaps) or an auto-computed
   * `bar_height` that fits all targets into the row height minus `outerPadding` on each side
   * (clamped to `0` rather than going negative when there isn't enough room). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>
    const op = brush.outerPadding as number
    const ip = brush.innerPadding as number
    const len = (this.brush.target ?? []).length

    this.g = this.chart.svg.group()
    this.zeroX = (this.axis.x as BrushAxisScale)(0)
    this.height = (this.axis.y as BrushAxisScale).rangeBand!()

    if ((brush.size as number) > 0) {
      this.bar_height = brush.size as number
      this.half_height = this.bar_height * len + (len - 1) * ip
    } else {
      this.half_height = this.height - op * 2
      this.bar_height = (this.half_height - (len - 1) * ip) / len
      this.bar_height = this.bar_height < 0 ? 0 : this.bar_height
    }
  }

  /** Draws every row's bars, one per target, stacked vertically within the row band using
   * `drawBefore()`'s precomputed `bar_height`/`half_height`. Each bar's length is
   * `|zeroX - resolvedX|`, where `resolvedX` is the value's x pixel position pushed outward to at
   * least `minSize` away from `zeroX` when it would otherwise be shorter (so near-zero values stay
   * visible/clickable); corners on the outward end are rounded by `borderRadius` unless the bar is
   * too thin or too short for it to fit. Bars pointing right of `zeroX` get their leading corners
   * rounded and are translated to start at `zeroX`; bars pointing left get their trailing corners
   * rounded and are positioned so their right edge sits at `zeroX`. Finishes by calling `drawETC()`
   * for tooltips/highlighting. */
  draw = (): any => {
    const points: BrushSeriesXY[] = this.getXY()
    const style = this.getBarStyle()
    const target = this.brush.target ?? []

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      let startY = this.offset('y', index) - this.half_height / 2

      for (let j = 0; j < target.length; j++) {
        const value = row[target[j]]
        const tooltipX = (this.axis.x as BrushAxisScale)(value)
        const tooltipY = startY + this.bar_height / 2
        const position = tooltipX >= this.zeroX ? 'right' : 'left'

        let resolvedX = tooltipX
        const minSize = (this.brush as Record<string, unknown>).minSize as number
        if (Math.abs(this.zeroX - resolvedX) < minSize) {
          resolvedX = position === 'right' ? resolvedX + minSize : resolvedX - minSize
        }

        const width = Math.abs(this.zeroX - resolvedX)
        const radius = width < style.borderRadius || this.bar_height < style.borderRadius ? 0 : style.borderRadius

        const r = this.getBarElement(index, j, {
          width,
          height: this.bar_height,
          value,
          tooltipX: resolvedX,
          tooltipY,
          position,
          max: points[j].max[index],
          min: points[j].min[index],
        })

        if (resolvedX >= this.zeroX) {
          r.round(width, this.bar_height, 0, radius, radius, 0)
          r.translate(this.zeroX, startY)
        } else {
          r.round(width, this.bar_height, radius, 0, 0, radius)
          r.translate(this.zeroX - width, startY)
        }

        this.g.append(r)

        startY += this.bar_height + ((this.brush as Record<string, unknown>).innerPadding as number)
      }
    })

    this.drawETC(this.g)

    return this.g
  }

  /** Plays the bar entrance animation: fades the whole group in over 1.4s, then, for every rendered
   * bar path element (identified via `Element.is('util.svg.element.path')` - see the inline
   * comment above for why this call is genuine, not a dead/throwing legacy check), slides it in
   * from an offset position toward its real `translate()` position over 0.7s. The offset is one bar
   * width away, on the right when `brush.animate === 'right'` and on the left otherwise, so bars
   * appear to grow in from a consistent side. */
  drawAnimate = (root: any): void => {
    const svg = this.chart.svg
    const type = (this.brush as Record<string, unknown>).animate

    root.append(
      svg.animate({
        attributeName: 'opacity',
        from: '0',
        to: '1',
        begin: '0s',
        dur: '1.4s',
        repeatCount: '1',
        fill: 'freeze',
      }),
    )

    root.each((_i: number, elem: any) => {
      // Legacy checks `elem.is("util.svg.element.path")` here. CORRECTION: an earlier pass
      // mis-diagnosed `jui-graph-ts`'s own `Element.is()` (`util/svg/element.ts`) as a preserved
      // "always throws `ReferenceError: jui is not defined`" bug and reverted this line away from
      // a working `typeof elem.join === 'function'` duck-typed substitute back to a call that
      // would crash - confirmed wrong by loading real `animate: true` demos
      // (`overlap_bar`/`active_bar`/`overlap_column`/`active_column`/`dashboard4`) directly
      // against the live legacy site: none of them throw. `Element.is()` is now a real,
      // non-throwing registry-backed `instanceof` check (see its own doc comment in
      // `util/svg/element.ts`), so this line is back to matching the real engine exactly, no
      // substitute needed.
      if (elem.is('util.svg.element.path')) {
        const xy = (elem.data('translate') as string).split(',')
        const x = parseInt(xy[0])
        const y = parseInt(xy[1])
        const w = parseInt(elem.attr('width'))
        const start = type === 'right' ? x + w : x - w

        elem.append(
          svg.animateTransform({
            attributeName: 'transform',
            type: 'translate',
            from: start + ' ' + y,
            to: x + ' ' + y,
            begin: '0s',
            dur: '0.7s',
            repeatCount: '1',
            fill: 'freeze',
          }),
        )
      }
    })
  }

  /** Returns this brush's own default options (`size`/`minSize`/`outerPadding`/`innerPadding`/
   * `active`/`activeEvent`/`display`/`format`), merged by `defineOptions()` on top of the inherited
   * `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return BAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('bar', BarBrush)
