// Port of legacy `src/brush/stackbar.js` ("chart.brush.stackbar", extend: "chart.brush.bar") -
// extends `BarBrush` (confirmed from the legacy file's own `extend:` field) via real TS class
// inheritance, but COMPLETELY overrides `getBarElement`/`setActiveEffect`/`drawBefore`/`draw`
// (never calls `super.xxx()` for any of them, matching the legacy source's own component() closure,
// which redefines all four rather than reusing `BarBrush`'s versions) - the only things genuinely
// reused from `BarBrush` are `getBarStyle()` (unmodified) and the `static setup()` chain-merge
// (`StackBarBrush`'s own `{outerPadding: 15, edge: false}` merges with `BarBrush`'s `size`/
// `minSize`/`innerPadding`/`active`/`activeEvent`/`display`/`format` defaults, then `CoreBrush`'s,
// then `Draw`'s - via `jui-graph-ts`'s now-fixed `defineOptions()` full-chain walk).
//
// Legacy's own `getBarElement(dataIndex, targetIndex)`/`barList` are UNRELATED to `BarBrush`'s
// same-named `getBarElement(dataIndex, targetIndex, info)`/`barList` (different signature/shape -
// in the original prototype-chain engine, `this.xxx` reassignment inside `component()` fully
// shadows the parent's, so the two are only nominally the same name, never actually shared state).
// Ported here with distinct field/method names (`stackGroupList` instead of `barList`, etc.) to
// avoid an artificial TypeScript "class extends" type conflict a real inheritance chain would
// otherwise force (`BarListItem[]` vs. a plain group-element array) - a pure internal-naming
// difference, not an observable behavior change (nothing external ever reads these field names).
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale } from 'jui-graph-ts'
import { BarBrush } from './bar'
import type { BarBrushOptions } from './bar'

/** `chart.brush.stackbar`'s own config fields. Despite completely overriding `BarBrush`'s
 * drawing methods (see this file's header comment), the engine's `static setup()` chain-merge
 * still layers `BarBrush`'s `size`/`minSize`/`innerPadding`/`active`/`activeEvent`/`display`/
 * `format` defaults underneath these, so they remain valid config keys here too. */
export interface StackBarBrushOptions extends BarBrushOptions {
  /** Padding reserved at the top/bottom of each row's stacked-segment group. */
  outerPadding?: number
  /** Draws a connecting line across each stacked bar's segment boundaries (visually links same
   * segment index across rows, like a mini stacked-area overlay on top of the bars). */
  edge?: boolean
}

/** Own `chart.brush.stackbar.setup()` fields - see legacy `stackbar.js`. */
export const STACK_BAR_BRUSH_OWN_DEFAULTS: StackBarBrushOptions = {
  outerPadding: 15,
  edge: false,
}

export class StackBarBrush extends BarBrush {
  protected stackGroupList: any[] = []
  protected stackTooltips: any[] = []
  protected tooltipIndexes: number[] = []
  protected edgeData: any[] = []

  // Legacy `stackbar.js`'s own `drawBefore()` also computes `height = axis.y.rangeBand()` into a
  // closure var - confirmed dead in the legacy source itself (never read anywhere in `draw()`,
  // which only ever uses `bar_height`) - not reproduced as a field here since TypeScript's
  // `noUnusedLocals` (unlike the untyped original) flags a write-only class field as an error;
  // dropping a truly-never-read value changes nothing observable.
  private stackBarSize = 0

  /** Registers one row's whole stacked-segment group into `stackGroupList`, so `setActiveEffect`
   * can later restyle it by index. Distinct from `BarBrush`'s own same-named `barList`/
   * `getBarElement` - see this file's header comment on why the two aren't actually shared state
   * despite the nominal overlap in the legacy source. */
  addBarElement(elem: any): void {
    this.stackGroupList.push(elem)
  }

  /** Builds one segment's plain colored rect (no rounded corners/min-size handling, unlike
   * `BarBrush.getBarElement`) - hides it outright (`display: 'none'`) when its value is exactly
   * `0`, and skips `addEvent()` for a zero value too (so a hidden segment is also non-interactive). */
  getBarElement(dataIndex: number, targetIndex: number): any {
    const style = this.getBarStyle()
    const color = this.color(targetIndex)
    const value = (this.getData(dataIndex) as Record<string, unknown>)[(this.brush.target ?? [])[targetIndex]]

    const r = this.chart.svg.rect({
      fill: color,
      stroke: style.borderColor,
      'stroke-width': style.borderWidth,
      'stroke-opacity': style.borderOpacity,
    })

    // 데이타가 0이면 화면에 표시하지 않음.
    if (value == 0) {
      r.attr({ display: 'none' })
    }

    if (value != 0) {
      this.addEvent(r, dataIndex, targetIndex)
    }

    return r
  }

  /** Dims every OTHER row's stacked group to `disableOpacity`, leaving `group` (the row that
   * matched an `activeEvent`/`active` trigger) at full opacity. Also toggles each row's stack
   * tooltip: visible when its row is the active one, OR when its index is already recorded in
   * `tooltipIndexes` (i.e. it's one of the `display`-driven min/max/all tooltips `setActiveTooltips`
   * already turned on), hidden otherwise. */
  setActiveEffect(group: any): void {
    const style = this.getBarStyle()
    const columns = this.stackGroupList
    const tooltips = this.stackTooltips

    for (let i = 0; i < columns.length; i++) {
      const opacity = group == columns[i] ? 1 : style.disableOpacity

      if (tooltips) {
        if (opacity == 1 || this.tooltipIndexes.indexOf(i) != -1) {
          tooltips[i].attr({ opacity: 1 })
        } else {
          tooltips[i].attr({ opacity: 0 })
        }
      }

      columns[i].attr({ opacity })
    }
  }

  /** Applies the initial `active`-row highlighting (from `brush.active`, an index into
   * `stackGroupList`) once every row has been drawn; a no-op when `active` doesn't resolve to an
   * existing row. */
  setActiveEffectOption(): void {
    const active = (this.brush as Record<string, unknown>).active as number
    if (this.stackGroupList && this.stackGroupList[active]) {
      this.setActiveEffect(this.stackGroupList[active])
    }
  }

  /** Wires `group`'s configured `activeEvent` (e.g. `'click'`) to highlight that row via
   * `setActiveEffect`. */
  setActiveEvent(group: any): void {
    group.on((this.brush as Record<string, unknown>).activeEvent, () => {
      this.setActiveEffect(group)
    })
  }

  /** Wires `group`'s active-toggle interaction (`setActiveEvent`) and cursor styling, but only
   * when `activeEvent` is actually configured. */
  setActiveEventOption(group: any): void {
    if ((this.brush as Record<string, unknown>).activeEvent != null) {
      this.setActiveEvent(group)
      group.attr({ cursor: 'pointer' })
    }
  }

  /** Resolves the shared row-lane height for every stacked segment: the configured `size` when
   * positive, otherwise the row band minus twice `outerPadding` (floored at `minSize`). */
  getTargetSize(): number {
    const height = (this.axis.y as BrushAxisScale).rangeBand!()
    const brush = this.brush as Record<string, unknown>

    if ((brush.size as number) > 0) {
      return brush.size as number
    } else {
      const size = height - (brush.outerPadding as number) * 2
      return size < (brush.minSize as number) ? (brush.minSize as number) : size
    }
  }

  /** Reveals (`opacity: 1`) each row's stack-total tooltip that matches `display`: the single row
   * at `minIndex` (`display === 'min'`) or `maxIndex` (anything else, effectively `'max'`), or
   * every row's tooltip when `display === 'all'` - and records each revealed row's index into
   * `tooltipIndexes` so `setActiveEffect` knows to keep it visible even when that row isn't the
   * currently-active one. */
  setActiveTooltips(minIndex: number | null, maxIndex: number | null): void {
    const type = (this.brush as Record<string, unknown>).display
    const activeIndex = type == 'min' ? minIndex : maxIndex

    for (let i = 0; i < this.stackTooltips.length; i++) {
      if (i == activeIndex || type == 'all') {
        this.stackTooltips[i].css({ opacity: 1 })
        this.tooltipIndexes.push(i)
      }
    }
  }

  /** Builds one row's stack-total tooltip text (initially `opacity: 0` - `setActiveTooltips`/
   * `setActiveEffect` reveal it later), anchored/offset according to `pos` (`'left'`/`'right'`
   * align the text start/end with a small inward nudge, `'top'`/anything else vertically offsets
   * a centered label above/below the point) and caches it into `stackTooltips[index]`. */
  drawStackTooltip(group: any, index: number, value: number, x: number, y: number, pos: string): void {
    const fontSize = this.chart.theme('tooltipPointFontSize') as number
    let orient = 'middle'
    let dx = 0
    let dy = 0

    if (pos == 'left') {
      orient = 'start'
      dx = 3
      dy = fontSize / 3
    } else if (pos == 'right') {
      orient = 'end'
      dx = -3
      dy = fontSize / 3
    } else if (pos == 'top') {
      dy = -(fontSize / 3)
    } else {
      dy = fontSize
    }

    const tooltip = this.chart
      .text({
        fill: this.chart.theme('tooltipPointFontColor'),
        'font-size': fontSize,
        'font-weight': this.chart.theme('tooltipPointFontWeight'),
        'text-anchor': orient,
        dx,
        dy,
        opacity: 0,
      })
      .text(this.format(value))
      .translate(x, y)

    this.stackTooltips[index] = tooltip
    group.append(tooltip)
  }

  /** Draws the `edge` config's connecting lines: for every consecutive pair of rows, one line per
   * target linking that segment's trailing edge in the PREVIOUS row to its leading edge in the
   * CURRENT row (using each cached `edgeData` entry's `x`/`width`/`ex`/`dx` offsets, which already
   * account for axis reversal - see `draw()`'s own `ex: isReverse ? opts.width : 0`) - visually
   * approximating a mini stacked-area overlay on top of the bars. Segments with zero `width`/
   * `height` (a `0`-value target) are skipped, so no line is drawn to/from a hidden segment. */
  drawStackEdge(g: any): void {
    const borderWidth = this.chart.theme('barStackEdgeBorderWidth')
    const target = this.brush.target ?? []

    for (let i = 1; i < this.edgeData.length; i++) {
      const pre = this.edgeData[i - 1]
      const now = this.edgeData[i]

      for (let j = 0; j < target.length; j++) {
        if (now[j].width > 0 && now[j].height > 0) {
          g.append(
            this.svg.line({
              x1: pre[j].x + pre[j].width - pre[j].ex,
              x2: now[j].x + now[j].dx - now[j].ex,
              y1: pre[j].y + pre[j].height - pre[j].ey,
              y2: now[j].y + now[j].dy,
              stroke: now[j].color,
              'stroke-width': borderWidth,
            }),
          )
        }
      }
    }
  }

  /** Arrow-function class field overriding `BarBrush.drawBefore` completely (see header comment -
   * never calls `super.drawBefore()`). Caches the shared segment lane height (`getTargetSize()`)
   * and resets the per-draw tooltip/edge tracking arrays so a redraw doesn't accumulate stale
   * entries from a prior one. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
    this.stackBarSize = this.getTargetSize()

    this.stackTooltips = []
    this.tooltipIndexes = []
    this.edgeData = []
  }

  /** Arrow-function class field overriding `BarBrush.draw` completely (see header comment). For
   * each row, stacks every target's segment end-to-end along x (`startX` running from the zero
   * point, `value` accumulating each target's contribution so the next segment starts where this
   * one ended), caching each segment's box + derived edge-linking geometry (`edgeData`) and
   * tracking which row has the largest/smallest stack total (`maxIndex`/`minIndex`, used by
   * `setActiveTooltips` when `display` is set). After every row is drawn, optionally draws the
   * `edge` connecting lines (`drawStackEdge`) and applies `display`/`active` tooltip and
   * highlight state. */
  draw = (): any => {
    const target = this.brush.target ?? []
    let maxIndex: number | null = null
    let maxValue = 0
    let minIndex: number | null = null
    let minValue = (this.axis.x as BrushAxisScale & { max(): number }).max()
    const isReverse = (this.axis.get('x') as Record<string, unknown>).reverse

    this.eachData((data, i) => {
      const row = data as Record<string, unknown>
      const index = i as number
      const group = this.chart.svg.group()

      const offsetY = this.offset('y', index)
      const startY = offsetY - this.stackBarSize / 2
      let startX = (this.axis.x as BrushAxisScale)(0)
      let value = 0
      let sumValue = 0

      for (let j = 0; j < target.length; j++) {
        const xValue = (row[target[j]] as number) + value
        const endX = (this.axis.x as BrushAxisScale)(xValue)
        const opts = {
          x: startX < endX ? startX : endX,
          y: startY,
          width: Math.abs(startX - endX),
          height: this.stackBarSize,
        }
        const r = this.getBarElement(index, j).attr(opts)

        if (!this.edgeData[index]) {
          this.edgeData[index] = {}
        }

        this.edgeData[index][j] = {
          color: this.color(j),
          dx: opts.width,
          dy: 0,
          ex: isReverse ? opts.width : 0,
          ey: 0,
          ...opts,
        }

        startX = endX
        value = xValue
        sumValue += row[target[j]] as number

        group.append(r)
      }

      if (sumValue > maxValue) {
        maxValue = sumValue
        maxIndex = index
      }
      if (sumValue < minValue) {
        minValue = sumValue
        minIndex = index
      }

      this.drawStackTooltip(group, index, sumValue, startX, offsetY, isReverse ? 'right' : 'left')
      this.setActiveEventOption(group)
      this.addBarElement(group)
      this.g.append(group)
    })

    if ((this.brush as Record<string, unknown>).edge) {
      this.drawStackEdge(this.g)
    }

    if ((this.brush as Record<string, unknown>).display != null) {
      this.setActiveTooltips(minIndex, maxIndex)
    }

    this.setActiveEffectOption()

    return this.g
  }

  /** Returns this brush's own config defaults (`STACK_BAR_BRUSH_OWN_DEFAULTS`); `builder.ts`'s
   * `defineOptions()` still layers `BarBrush`'s own defaults underneath (see header comment). */
  static setup(): Record<string, unknown> {
    return STACK_BAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('stackbar', StackBarBrush)
