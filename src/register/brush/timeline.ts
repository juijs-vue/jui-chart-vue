// Port of legacy `src/brush/timeline.js` ("chart.brush.timeline", extend: "chart.brush.core") -
// extends `CoreBrush` directly. A Gantt-style timeline: a `range`-typed x-axis (start/end
// timestamps) crossed with a `block`-typed y-axis (one row per unique "key" value, via
// `axis.y.rangeBand()`/`.domain()` - both confirmed present on the real ported `ordinal()` scale in
// `util/scale.ts`), drawing one horizontal bar per data row plus a connecting line to the NEXT
// row's start (when contiguous) and a background "hover row"/"active" highlight layer per row.
//
// **Mixed `this.svg.*` / `this.chart.text()` call surface, literal to the source**: unlike most
// brushes ported so far (which use `this.svg.*` uniformly for brush-owned elements), `timeline.js`
// itself mixes `this.svg.rect`/`this.svg.line`/`this.svg.text` (bar/line/tooltip-text primitives)
// with `this.chart.text(...)` (row-title and column-header labels) - reproduced exactly as split
// in the original, not normalized to one or the other.
//
// **`setActiveRect`/`setHoverRect` vs. `setActiveBar`/`setHoverBar` - two entirely separate
// interaction models selected by `activeType`** ("rect" - the default, using the invisible
// full-row `r2` overlay rect - vs. any other value, using the visible bar `r1` itself), each with
// its own independent state (`cacheRectIndex`) and own visual-attribute set - ported as two
// parallel method pairs, exactly as split in the original (no shared abstraction invented).
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.timeline`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface TimelineBrushOptions {
  /** Height in px of each row's timeline bar. */
  barSize?: number
  /** Stroke width in px of the connecting line drawn to a contiguous next row. */
  lineWidth?: number
  /** Index of the row to show a permanent active/highlighted state for, on mount. */
  active?: number | null
  /** DOM event name that toggles a row's active/highlighted state when it fires on that row. */
  activeEvent?: string
  /** Which element the active/hover highlight targets: the invisible full-row overlay (`'rect'`,
   * the default) or the visible bar itself (any other value) - two independent interaction models,
   * not a shared abstraction (see this file's header comment). */
  activeType?: string
  /** Formats the tooltip content shown for the active row; no tooltip is shown when `null`. */
  activeTooltip?: ((...args: unknown[]) => unknown) | null
  /** Hides each row's title/label text, showing only the bars. */
  hideTitle?: boolean
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `timeline.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.timeline.setup()` fields - see legacy `timeline.js`. */
export const TIMELINE_BRUSH_OWN_DEFAULTS: TimelineBrushOptions = {
  barSize: 7,
  lineWidth: 1,
  active: null,
  activeEvent: 'click',
  activeType: 'rect',
  activeTooltip: null,
  hideTitle: false,
  clip: false,
}

interface TimelineCacheRow {
  r1: any
  r2: any
  t1: any
  color: string
  y: number
  height: number
}

export class TimelineBrush extends CoreBrush {
  private g: any = null
  private padding: { left: number; top: number; right: number; bottom: number } | null = null
  private domains: (string | number)[] = []
  private height = 0
  private ticks: number[] = []
  private titleX = 0
  private active: number | null = null
  private activeType: string | null = null
  private startX = 0
  private keyToIndex: Record<string, number> = {}
  // **PRESERVED QUIRK**: like `keyToIndex` above, `cacheRect`/`cacheRectIndex` are module-closure
  // variables in the original, initialized once and never cleared - `drawData()` below only ever
  // `.push()`es onto `cacheRect`, so a second `draw()` call on the same brush instance (without a
  // full remount) would accumulate stale rows referencing already-detached elements alongside the
  // new ones. Not defensively reset here.
  private cacheRect: TimelineCacheRow[] = []
  private cacheRectIndex: number | null = null

  setActiveRect(target: unknown): void {
    for (let k = 0; k < this.cacheRect.length; k++) {
      const r1 = this.cacheRect[k].r1
      const r2 = this.cacheRect[k].r2
      const color = this.cacheRect[k].color
      const isTarget = r2.element === target

      r1.attr({
        fill: isTarget ? this.chart.theme('timelineActiveBarBackgroundColor') : color,
      })

      r2.attr({
        fill: isTarget ? this.chart.theme('timelineActiveLayerBackgroundColor') : this.chart.theme('timelineHoverLayerBackgroundColor'),
        stroke: isTarget ? this.chart.theme('timelineActiveLayerBorderColor') : this.chart.theme('timelineHoverLayerBorderColor'),
        'fill-opacity': isTarget ? this.chart.theme('timelineLayerBackgroundOpacity') : 0,
        'stroke-width': isTarget ? 1 : 0,
      })

      if (isTarget) {
        this.cacheRectIndex = k
      }
    }
  }

  setHoverRect(target: unknown): void {
    for (let k = 0; k < this.cacheRect.length; k++) {
      const r2 = this.cacheRect[k].r2
      const isTarget = r2.element === target

      r2.attr({
        fill: isTarget && this.cacheRectIndex === k ? this.chart.theme('timelineActiveLayerBackgroundColor') : this.chart.theme('timelineHoverLayerBackgroundColor'),
        stroke: isTarget && this.cacheRectIndex === k ? this.chart.theme('timelineActiveLayerBorderColor') : this.chart.theme('timelineHoverLayerBorderColor'),
        'fill-opacity': isTarget || this.cacheRectIndex === k ? this.chart.theme('timelineLayerBackgroundOpacity') : 0,
        'stroke-width': isTarget || this.cacheRectIndex === k ? 1 : 0,
      })
    }
  }

  setActiveBar(target: unknown): void {
    for (let k = 0; k < this.cacheRect.length; k++) {
      const r1 = this.cacheRect[k].r1
      const t1 = this.cacheRect[k].t1
      const color = this.cacheRect[k].color
      const y1 = this.cacheRect[k].y - this.height / 2
      const y2 = this.cacheRect[k].y - this.cacheRect[k].height / 2
      const isTarget = r1.element === target

      if (isTarget) {
        r1.attr({
          fill: this.chart.theme('timelineActiveBarBackgroundColor') || color,
          height: this.height,
          y: y1,
        })

        t1.attr({ visibility: 'visible' })
      } else {
        r1.attr({
          fill: color,
          height: this.cacheRect[k].height,
          y: y2,
        })

        t1.attr({ visibility: 'hidden' })
      }

      if (isTarget) {
        this.cacheRectIndex = k
      }
    }
  }

  setHoverBar(target: unknown): void {
    const hoverColor = this.chart.theme('timelineHoverBarBackgroundColor')
    const activeColor = this.chart.theme('timelineActiveBarBackgroundColor')

    for (let k = 0; k < this.cacheRect.length; k++) {
      const r1 = this.cacheRect[k].r1
      const color = this.cacheRect[k].color
      const isTarget = r1.element === target

      r1.attr({
        fill: isTarget && this.cacheRectIndex !== k ? hoverColor || color : this.cacheRectIndex === k ? activeColor || color : color,
      })
    }
  }

  drawBefore = (): void => {
    this.g = this.svg.group()
    this.padding = this.axis.get('padding') as { left: number; top: number; right: number; bottom: number }
    this.domains = (this.axis.y as BrushAxisScale & { domain(): (string | number)[] }).domain()
    this.height = (this.axis.y as BrushAxisScale & { rangeBand(): number }).rangeBand()
    // **PRESERVED QUIRK**: the original computes `width = this.axis.x.rangeBand()` in `drawBefore`
    // but never actually reads `width` anywhere else in the file (confirmed by reading `drawGrid`/
    // `drawLine`/`drawData` in full) - genuine dead computation in the real upstream engine. Kept
    // as a call for parity (in case a future scale implementation ever had a read side effect,
    // though `rangeBand()` has none here) without storing an always-unused class field for it.
    void (this.axis.x as BrushAxisScale & { rangeBand(): number }).rangeBand()
    this.ticks = (this.axis.x as BrushAxisScale & { ticks(step: number): number[] }).ticks((this.axis.get('x') as Record<string, unknown>).step as number)
    const brush = this.brush as Record<string, unknown>
    this.active = brush.active as number | null
    this.activeType = brush.activeType as string
    this.startX = brush.hideTitle ? 0 : this.padding.left
    this.titleX = this.axis.area('x') - this.startX

    // **PRESERVED QUIRK**: `keyToIndex` (like `cacheRect`/`cacheRectIndex` below) is a
    // module-closure variable in the original, declared ONCE and never reset inside
    // `drawBefore()` - this loop only ever OVERWRITES existing keys with fresh values, it never
    // clears stale ones first. Harmless when a chart's domain keys stay the same across redraws,
    // but a literal port nonetheless (not defensively reset to `{}` here).
    for (let i = 0; i < this.domains.length; i++) {
      this.keyToIndex[this.domains[i] as unknown as string] = i
    }
  }

  drawGrid(): void {
    const yFormat = (this.axis.get('y') as Record<string, unknown>).format
    const rowWidth = this.axis.area('width') + this.startX

    const columnColor = this.chart.theme('timelineColumnBackgroundColor')
    const hoverColor = this.chart.theme('timelineHoverRowBackgroundColor')
    const evenColor = this.chart.theme('timelineEvenRowBackgroundColor')
    const oddColor = this.chart.theme('timelineOddRowBackgroundColor')

    for (let j = 0; j < this.domains.length; j++) {
      const domain = this.domains[j]
      const y = (this.axis.y as BrushAxisScale)(j)
      const fill = j === 0 ? columnColor : j % 2 ? evenColor : oddColor

      const r = this.svg.rect({
        width: rowWidth,
        height: this.height,
        fill,
        x: this.titleX,
        y: y - this.height / 2,
      })

      if (j > 0) {
        r.hover(
          () => {
            r.attr({ fill: hoverColor })
          },
          () => {
            r.attr({ fill: j % 2 ? evenColor : oddColor })
          },
        )
      }

      this.g.append(r)

      if (this.startX > 0) {
        const txt = this.chart
          .text({
            'text-anchor': 'start',
            dx: 5,
            dy: (this.chart.theme('timelineTitleFontSize') as number) / 3,
            'font-size': this.chart.theme('timelineTitleFontSize'),
            fill: this.chart.theme('timelineTitleFontColor'),
            'font-weight': this.chart.theme('timelineTitleFontWeight'),
          })
          .translate(this.titleX, y)

        const contents = typeof yFormat === 'function' ? (yFormat as (...a: unknown[]) => unknown).apply(this.chart, [domain, j]) : domain

        txt.html(contents)

        txt.on('mouseover', (e: unknown) => {
          this.chart.emit('timeline.title', [domain, e])
        })

        this.g.append(txt)
      }
    }
  }

  drawLine(): void {
    const y = (this.axis.y as BrushAxisScale)(0) - this.height / 2
    const xFormat = (this.axis.get('x') as Record<string, unknown>).format

    for (let i = 0; i < this.ticks.length; i++) {
      const x = (this.axis.x as BrushAxisScale)(this.ticks[i])

      if (i < this.ticks.length - 1) {
        const vline = this.svg.line({
          stroke: this.chart.theme(i === 0 ? 'timelineHorizontalLineColor' : 'timelineVerticalLineColor'),
          'stroke-width': 1,
          x1: x,
          x2: x,
          y1: y,
          y2: y + this.axis.area('height'),
          visibility: this.startX === 0 && i === 0 ? 'hidden' : 'visible',
        })

        this.g.append(vline)
      }

      if (i > 0) {
        const txt = this.chart
          .text({
            'text-anchor': 'end',
            dx: -5,
            dy: (this.chart.theme('timelineColumnFontSize') as number) / 2,
            'font-size': this.chart.theme('timelineColumnFontSize'),
            fill: this.chart.theme('timelineColumnFontColor'),
          })
          .translate(x, (this.axis.y as BrushAxisScale)(0))

        const contents = typeof xFormat === 'function' ? (xFormat as (...a: unknown[]) => unknown).apply(this.chart, [this.ticks[i], i]) : this.ticks[i]

        txt.text(contents)

        this.g.append(txt)
      }
    }

    const hline = this.svg.line({
      stroke: this.chart.theme('timelineHorizontalLineColor'),
      'stroke-width': 1,
      x1: this.titleX,
      x2: this.axis.area('width') + (this.padding as { left: number }).left,
      y1: y + this.height,
      y2: y + this.height,
    })

    this.g.append(hline)
  }

  drawData(): void {
    const bg_height = this.axis.area('height')
    const startY = this.axis.area('y')
    const len = this.axis.data.length
    const brush = this.brush as Record<string, unknown>
    const size = brush.barSize
    const tooltipFormat = brush.activeTooltip
    const activeFontSize = this.chart.theme('timelineActiveBarFontSize')
    const activeFontColor = this.chart.theme('timelineActiveBarFontColor')

    for (let i = 0; i < len; i++) {
      const d = this.axis.data[i] as BrushData
      const x1 = (this.axis.x as BrushAxisScale)(this.getValue(d, 'stime', 0))
      const x2 = (this.axis.x as BrushAxisScale)(this.getValue(d, 'etime', (this.axis.x as BrushAxisScale & { max(): number }).max()))
      const y = (this.axis.y as BrushAxisScale)(this.keyToIndex[this.getValue(d, 'key') as string])
      const h = typeof size === 'function' ? (size as (...a: unknown[]) => unknown).apply(this.chart, [d, i]) : size
      const color = this.color(i, 0)

      if (x2 - x1 < 0 || isNaN(x2)) {
        continue
      }

      const r1 = this.svg.rect({
        width: x2 - x1,
        height: h,
        fill: color,
        x: x1,
        y: y - (h as number) / 2,
        cursor: 'pointer',
      })

      const t1 = this.svg.text({
        'text-anchor': 'end',
        'font-size': activeFontSize,
        fill: activeFontColor,
        x: x1 + x2 - x1,
        y,
        dx: -(activeFontSize as number) / 2,
        dy: (activeFontSize as number) / 3,
        visibility: 'hidden',
      })

      const r2 = this.svg.rect({
        width: x2 - x1,
        height: bg_height - 6,
        'fill-opacity': 0,
        'stroke-width': 0,
        x: x1,
        y: startY + 3,
        cursor: 'pointer',
      })

      if (i < len - 1) {
        const dd = this.axis.data[i + 1] as BrushData
        const xx1 = (this.axis.x as BrushAxisScale)(this.getValue(dd, 'stime', 0))
        const yy = (this.axis.y as BrushAxisScale)(this.keyToIndex[this.getValue(dd, 'key') as string])

        const l = this.svg.line({
          x1: x2,
          y1: y,
          x2: xx1,
          y2: yy,
          stroke: color,
          'stroke-width': brush.lineWidth,
        })

        this.g.append(l)
      }

      if (typeof tooltipFormat === 'function') {
        t1.text((tooltipFormat as (...a: unknown[]) => unknown).apply(this.chart, [d, i]))
      }

      this.g.append(r1)
      this.g.append(t1)
      this.g.append(r2)

      this.addEvent(r1, i)

      this.cacheRect.push({ r1, r2, t1, color, y, height: h as number })

      if (this.activeType === 'rect') {
        r2.on(brush.activeEvent, (e: unknown) => {
          this.setActiveRect(e && (e as { target: unknown }).target)
          this.chart.emit('timeline.active', [d, e])
        })

        r2.on('mouseover', (e: { target: unknown }) => {
          this.setHoverRect(e.target)
        })
      } else {
        r2.attr({ visibility: 'hidden' })

        r1.on(brush.activeEvent, (e: unknown) => {
          this.setActiveBar(e && (e as { target: unknown }).target)
          this.chart.emit('timeline.active', [d, e])
        })

        r1.on('mouseover', (e: { target: unknown }) => {
          this.setHoverBar(e.target)
        })
      }
    }

    if (typeof this.active === 'number' && Number.isInteger(this.active) && this.cacheRect.length > 0) {
      if (this.active < 0) return
      this.cacheRectIndex = this.active

      if (this.activeType === 'rect') {
        this.setActiveRect(this.cacheRect[this.cacheRectIndex].r2.element)
      } else {
        this.setActiveBar(this.cacheRect[this.cacheRectIndex].r1.element)
      }
    }
  }

  draw = (): any => {
    this.drawGrid()
    this.drawLine()
    this.drawData()

    this.g.on('mouseout', () => {
      if (this.activeType === 'rect') {
        this.setHoverRect(null)
      } else {
        this.setHoverBar(null)
      }
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return TIMELINE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('timeline', TimelineBrush)
