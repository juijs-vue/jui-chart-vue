// Port of legacy `src/widget/legend.js` ("chart.widget.legend", extend: "chart.widget.core").
import { CoreWidget, registerWidget } from 'jui-graph-ts'

const WIDTH = 17
const HEIGHT = 13
const PADDING = 5
const RADIUS = 5.5
const RATIO = 1.2
const POINT = 2

/** `chart.widget.legend`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface LegendWidgetOptions {
  /** Which side of the chart area the legend sits along. */
  orient?: 'bottom' | 'top' | 'left' | 'right'
  /** Alignment of the legend entries along that side. */
  align?: 'start' | 'center' | 'end'
  /** When true, clicking a legend entry toggles that target's visibility on the referenced
   * brush(es) (and caches the visible-target list under `legend_target`, read by other widgets
   * like `guideline`). */
  filter?: boolean
  /** Overrides the legend swatch's icon: a fixed icon name, or a function of the target name
   * returning one. `null` uses the default color-box swatch. */
  icon?: string | ((this: unknown, target: string) => string) | null
  /** Extra x offset in px, applied after position calculation. */
  dx?: number
  /** Extra y offset in px, applied after position calculation. */
  dy?: number
  /** Overrides the per-entry swatch colors (falls back to the referenced brush's own `colors`,
   * then the chart's theme palette). */
  colors?: unknown[] | null
  /** When true and `brush` names multiple brush indexes, a filter toggle applies to all of them
   * together instead of just the first. */
  brushSync?: boolean
  /** Which brush(es) this legend reflects/controls - a single index or an array of indexes. */
  brush?: number | number[]
  /** Formats each entry's label text; defaults to the raw target name when `null`. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.widget.legend.setup()` fields - see legacy `legend.js`. */
export const LEGEND_WIDGET_OWN_DEFAULTS: LegendWidgetOptions = {
  orient: 'bottom',
  align: 'center',
  filter: false,
  icon: null,
  dx: 0,
  dy: 0,
  colors: null,
  brushSync: false,
  brush: 0,
  format: null,
}

interface LegendIconEntry {
  icon: any
  width: number
  height: number
}

export class LegendWidget extends CoreWidget {
  // `this.chart` is already typed as `WidgetChart` by `CoreWidget` itself (`widget/core.ts`).
  private columns: Record<number, Record<string, boolean>> = {}
  private colorIndex: Record<string, string> = {}

  /** A private, functionally-identical copy of `CoreWidget.getIndexArray()` (normalizes
   * `widget.brush` into an array, defaulting to `[0]`) - kept as its own local helper rather than
   * calling the inherited one, matching the legacy `legend.js` source's own duplicate copy. */
  private getIndexArrayLocal(brush: unknown): number[] {
    let list = [0]

    if (Array.isArray(brush)) {
      list = brush as number[]
    } else if (typeof brush === 'number' && Number.isInteger(brush)) {
      list = [brush]
    }

    return list
  }

  /** Resolves every brush index in `widget.brush` (via `getIndexArrayLocal`) to its actual brush
   * config object (`chart.get('brush', index)`) - used by `widget.brushSync` to apply a filter
   * toggle to all referenced brushes at once. */
  private getBrushAll(): any[] {
    const list = this.getIndexArrayLocal((this.widget as Record<string, unknown>).brush)
    const result: any[] = []

    for (let i = 0; i < list.length; i++) {
      result[i] = (this.chart as unknown as { get(type: string, key: number): any }).get('brush', list[i])
    }

    return result
  }

  /** When `widget.filter` is enabled, marks every one of `brush.target`'s CURRENT entries visible
   * (`true`) in `this.columns[brush.index]` - the per-target on/off map the click-to-toggle
   * swatches in `getLegendIcon()` flip. Runs on every `draw()`, not just the first: since toggling
   * a swatch off calls `updateBrush()` with a `target` array that already excludes the hidden
   * entry (see `changeTargetOption()`), a re-render's `brush.target` only ever contains the
   * still-visible targets, so this re-sync never resurrects an already-hidden one - it just seeds
   * `true` for whatever's currently in the (possibly already-filtered) target list. A no-op when
   * `widget.filter` is off. */
  private setLegendStatus(brush: any): void {
    if (!(this.widget as Record<string, unknown>).filter) return

    if (!this.columns[brush.index]) {
      this.columns[brush.index] = {}
    }

    for (let i = 0; i < brush.target.length; i++) {
      this.columns[brush.index][brush.target[i]] = true
    }
  }

  /** Applies the current filter toggle state to every brush in `brushList`: rebuilds a `target`/
   * `colors` pair from whichever keys are still marked `true` in `this.columns[brushList[0].index]`
   * (all brushes in the list share the SAME column map - the one keyed by the first brush's index,
   * relevant when `widget.brushSync` passes multiple brushes here), pushes it onto each brush via
   * `chart.updateBrush()`, force-renders if a render isn't already pending, caches the surviving
   * target list under `'legend_target'` (read back by `guideline.ts`'s content tooltip - see this
   * file's own reference from there), and emits `'legend.filter'` with that same list. */
  private changeTargetOption(brushList: any[]): void {
    const target: string[] = []
    const colors: string[] = []
    const index = brushList[0].index

    for (const key in this.columns[index]) {
      if (this.columns[index][key]) {
        target.push(key)
        colors.push(this.colorIndex[key])
      }
    }

    for (let i = 0; i < brushList.length; i++) {
      ;(this.chart as unknown as { updateBrush(index: number, brush: Record<string, unknown>): void }).updateBrush(brushList[i].index, {
        target,
        colors,
      })
    }

    if (!(this.chart as unknown as { isRender(): boolean }).isRender()) {
      ;(this.chart as unknown as { render(): void }).render()
    }

    ;(this.chart as unknown as { setCache(key: string, value: unknown): void }).setCache('legend_target', target)
    this.chart.emit('legend.filter', [target])
  }

  /** Builds one legend entry (an icon/swatch + label group, plus its measured `width`/`height`) per
   * target in `brush.target`. When `widget.filter` is true, the swatch is a toggle switch (a
   * rounded pill + sliding circle knob) wired with a `click` handler that flips
   * `this.columns[brush.index][target]`, restyles the knob, and calls `changeTargetOption()` (on
   * every referenced brush when `widget.brushSync`, otherwise just this one). Otherwise the swatch
   * is a plain color dot, or `widget.icon`'s custom glyph/generator when set. Label text goes
   * through `widget.format` when it's a function. */
  getLegendIcon(brush: any): LegendIconEntry[] {
    const chart = this.chart
    const widget = this.widget as Record<string, unknown>
    const arr: LegendIconEntry[] = []
    const data: string[] = brush.target
    const count = data.length

    for (let i = 0; i < count; i++) {
      const group = chart.svg.group()
      const target = brush.target[i]
      let text = target
      const color = chart.color(i, widget.colors || brush.colors)

      this.colorIndex[target] = color

      if (typeof widget.format === 'function') {
        text = this.format(target) as string
      }

      const rect = chart.svg.getTextSize(text, {
        fontSize: chart.theme('legendFontSize') as number,
      })

      if (widget.filter) {
        group.append(
          chart.svg.line({
            x1: 0,
            x2: WIDTH,
            y1: -(RADIUS / 2),
            y2: -(RADIUS / 2),
            stroke: color,
            'stroke-width': HEIGHT,
            'stroke-linecap': 'round',
          }),
        )

        group.append(
          chart.svg.circle({
            cx: WIDTH,
            cy: -(RADIUS / 2),
            r: RADIUS,
            fill: chart.theme('legendSwitchCircleColor'),
          }),
        )

        group.append(
          chart.text(
            {
              x: WIDTH + PADDING * 2,
              y: 0,
              'font-size': chart.theme('legendFontSize'),
              fill: chart.theme('legendFontColor'),
              'text-anchor': 'start',
            },
            text,
          ),
        )

        arr.push({
          icon: group,
          width: WIDTH + rect.width + PADDING * 2.5,
          height: HEIGHT + PADDING / 2,
        })

        const key = target
        const element = group

        element.attr({ cursor: 'pointer' })

        element.on('click', () => {
          if (this.columns[brush.index][key]) {
            element.get(0)!.attr({ stroke: chart.theme('legendSwitchDisableColor') })
            element.get(2)!.attr({ fill: chart.theme('legendSwitchDisableColor') })
            ;(element.get(1) as any).attr({ cx: 0 })
            this.columns[brush.index][key] = false
          } else {
            element.get(0)!.attr({ stroke: this.colorIndex[key] })
            element.get(2)!.attr({ fill: chart.theme('legendFontColor') })
            ;(element.get(1) as any).attr({ cx: WIDTH })
            this.columns[brush.index][key] = true
          }

          this.changeTargetOption(widget.brushSync ? this.getBrushAll() : [brush])
        })
      } else {
        const size = chart.theme('legendFontSize') as number

        if (widget.icon != null) {
          const icon = typeof widget.icon === 'function' ? (widget.icon as (this: unknown, target: string) => string).apply(chart, [target]) : widget.icon

          group.append(
            chart.text(
              {
                x: 0,
                y: POINT,
                'font-size': size,
                fill: color,
              },
              icon as string,
            ),
          )
        } else {
          group.append(
            chart.svg.circle({
              cx: size / 2,
              cy: -POINT,
              r: size / 2,
              fill: color,
            }),
          )
        }

        group.append(
          chart.text(
            {
              x: size * RATIO,
              y: 0,
              'font-size': size,
              fill: chart.theme('legendFontColor'),
              'text-anchor': 'start',
            },
            text,
          ),
        )

        arr.push({
          icon: group,
          width: size + rect.width + PADDING * 2,
          height: HEIGHT + PADDING / 2,
        })
      }
    }

    return arr
  }

  /** Lays out every configured brush's legend entries (`getLegendIcon()`) in a flow: for a
   * horizontal `orient` (`'top'`/`'bottom'`), entries wrap onto a new row once they'd overflow the
   * chart's right edge (`chart.area('x2')`); for a vertical `orient`, entries stack in a single
   * column. `widget.brushSync` only actually draws the FIRST configured brush's entries (later ones
   * are skipped via `continue`) even though a sync'd filter toggle still updates every brush. The
   * whole flow is then translated into position per `widget.orient`/`widget.align` plus
   * `widget.dx`/`widget.dy`, and `setLegendStatus()` seeds each drawn brush's filter state. */
  draw = (): any => {
    const chart = this.chart
    const widget = this.widget as Record<string, unknown>
    const group = chart.svg.group()

    let x = 0
    let y = 0
    let total_width = 0
    let total_height = 0
    let max_width = 0
    let max_height = 0
    const brushes = this.getIndexArrayLocal(widget.brush)

    const total_widthes: number[] = []

    for (let i = 0; i < brushes.length; i++) {
      const index = brushes[i]

      if (widget.brushSync && i > 0) continue

      const brush = (chart as unknown as { get(type: string, key: number): any }).get('brush', index)
      const arr = this.getLegendIcon(brush)

      for (let k = 0; k < arr.length; k++) {
        group.append(arr[k].icon)
        arr[k].icon.translate(x, y)

        if (widget.orient == 'bottom' || widget.orient == 'top') {
          if (x + arr[k].width > chart.area('x2')) {
            x = 0
            y += arr[k].height
            max_height += arr[k].height
            arr[k].icon.translate(x, y)
            total_widthes.push(total_width)
            total_width = 0
          }

          x += arr[k].width + PADDING * 2.5
          total_width += arr[k].width + PADDING * 2.5

          if (max_height < arr[k].height) {
            max_height = arr[k].height
          }
        } else {
          y += arr[k].height
          total_height += arr[k].height

          if (max_width < arr[k].width) {
            max_width = arr[k].width
          }
        }
      }

      if (total_width > 0) {
        total_widthes.push(total_width)
      }

      if (total_widthes.length > 0) {
        total_width = Math.max(...total_widthes)
      }

      this.setLegendStatus(brush)
    }

    if (widget.orient == 'bottom' || widget.orient == 'top') {
      y = (widget.orient == 'bottom' ? chart.area('y2') + chart.padding('bottom') - max_height : chart.area('y') - chart.padding('top')) + PADDING

      if (widget.align == 'start') {
        x = chart.area('x')
      } else if (widget.align == 'center') {
        x = chart.area('x') + (chart.area('width') / 2 - total_width / 2)
      } else if (widget.align == 'end') {
        x = chart.area('x2') - total_width
      }
    } else {
      x = (widget.orient == 'left' ? chart.area('x') - chart.padding('left') : chart.area('x2') + chart.padding('right') - max_width) + PADDING

      if (widget.align == 'start') {
        y = chart.area('y')
      } else if (widget.align == 'center') {
        y = chart.area('y') + (chart.area('height') / 2 - total_height / 2)
      } else if (widget.align == 'end') {
        y = chart.area('y2') - total_height
      }
    }

    group.translate(Math.floor(x) + (widget.dx as number), Math.floor(y) + (widget.dy as number))

    return group
  }

  /** Supplies `LEGEND_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return LEGEND_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('legend', LegendWidget)
