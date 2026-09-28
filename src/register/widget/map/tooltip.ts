// Port of legacy `src/widget/map/tooltip.js` ("chart.widget.map.tooltip", extend:
// "chart.widget.tooltip") - extends the already-registered `TooltipWidget` (confirmed from the
// legacy file's own `extend:` field - NOT `chart.widget.map.core`, despite the `map.` namespace),
// but completely overrides `drawBefore()`/`draw()` with its own hover-balloon wired to the Map
// engine's own `"map.mouseover"`/`"map.mousemove"`/`"map.mouseout"` events (rather than
// `TooltipWidget`'s own axis-point-based positioning).
import { registerWidget } from 'jui-graph-ts'
import { TooltipWidget } from '../tooltip'
import type { TooltipWidgetOptions } from '../tooltip'

/** `chart.widget.map.tooltip` has no `setup()` override of its own - it inherits
 * `TooltipWidget`'s `TOOLTIP_WIDGET_OWN_DEFAULTS`/`TooltipWidgetOptions` verbatim, but this
 * subclass's own `drawBefore()`/`draw()` (both fully overridden, wired to `map.*` events instead
 * of axis/brush ones) only actually reads `orient` and `format` from it - `anchor`/`all`/`line`/
 * `flip`/`brush` are inherited fields with no effect here. Re-exported under this file's own name
 * purely so the generated docs for `"map.tooltip"` point at something, not because the shape
 * differs. */
export type MapTooltipWidgetOptions = TooltipWidgetOptions

const PADDING = 7
const ANCHOR = 7
const TEXT_Y = 14

interface MapMouseEvent {
  bgX: number
  bgY: number
}

export class MapTooltipWidget extends TooltipWidget {
  private g: any
  private text: any
  private rect: any

  /** Resolves the tooltip's message for a hovered map feature: `widget.format` when it's a
   * function (called via the inherited `Draw.format()` wrapper), otherwise the feature's own `id`
   * field. Unlike the base `TooltipWidget`'s `getFormat()`, there's no key/value row concept here -
   * just one label string per feature. */
  private mapGetFormat(data: Record<string, unknown>): unknown {
    if (typeof (this.widget as Record<string, unknown>).format === 'function') {
      return this.format(data)
    }

    return data.id
  }

  /** Resolves and writes the label text for the hovered feature `obj` into `this.text` (via
   * `mapGetFormat()`), repositioning it below the balloon's anchor point when `widget.orient` is
   * `'bottom'`, and center-aligning it once there's real, non-empty text. Returns the resolved
   * message so `draw()`'s `map.mouseover` handler can skip showing the balloon entirely when it's
   * falsy. */
  private mapPrintTooltip(obj: Record<string, unknown>): unknown {
    const msg = this.mapGetFormat(obj)
    const widget = this.widget as Record<string, unknown>

    if (widget.orient == 'bottom') {
      this.text.attr({ y: TEXT_Y + ANCHOR })
    }

    if (typeof msg === 'string' && msg != '') {
      this.text.text(msg)
      this.text.attr({ 'text-anchor': 'middle' })
    }

    return msg
  }

  /** Fully overrides the base `TooltipWidget.drawBefore()`: builds a single hidden balloon group
   * (one `polygon` background + one `text` label) rather than one per brush/target, since this
   * widget positions off `map.*` events instead of axis/brush data. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group({ visibility: 'hidden' }, () => {
      this.rect = this.chart.svg.polygon({
        fill: this.chart.theme('tooltipBackgroundColor'),
        'fill-opacity': this.chart.theme('tooltipBackgroundOpacity'),
        stroke: this.chart.theme('tooltipBorderColor'),
        'stroke-width': 1,
      })

      this.text = this.chart.text({
        'font-size': this.chart.theme('tooltipFontSize'),
        fill: this.chart.theme('tooltipFontColor'),
        y: TEXT_Y,
      })
    })
  }

  /** Fully overrides the base `TooltipWidget.draw()`: wires `map.mouseover`/`map.mousemove`/
   * `map.mouseout` (the Map engine's own hover events, not axis/brush ones) to show, follow, and
   * hide the balloon built in `drawBefore()`. `map.mouseover` measures the resolved label
   * (`mapPrintTooltip()`) and re-shapes the balloon polygon via `balloonPoints(widget.orient, ...)`;
   * `map.mousemove` repositions it around the cursor (`e.bgX`/`e.bgY`), applying the same
   * `widget.orient`-based offset logic as the base widget's own `getTooltipXY()`, just inlined here
   * instead of shared. */
  draw = (): any => {
    const widget = this.widget as Record<string, unknown>
    let isActive = false
    let w = 0
    let h = 0

    this.on('map.mouseover', (obj: Record<string, unknown>) => {
      if (!this.mapPrintTooltip(obj)) return

      const size = this.text.size()
      w = size.width + PADDING * 2
      h = size.height + PADDING

      this.text.attr({ x: w / 2 })
      this.rect.attr({ points: this.balloonPoints(widget.orient as string, w, h, ANCHOR) })
      this.g.attr({ visibility: 'visible' })

      isActive = true
    })

    this.on('map.mousemove', (_obj: unknown, e: MapMouseEvent) => {
      if (!isActive) return

      let x = e.bgX - w / 2
      let y = e.bgY - h - ANCHOR - PADDING / 2

      if (widget.orient == 'left' || widget.orient == 'right') {
        y = e.bgY - h / 2 - PADDING / 2
      }

      if (widget.orient == 'left') {
        x = e.bgX - w - ANCHOR
      } else if (widget.orient == 'right') {
        x = e.bgX + ANCHOR
      } else if (widget.orient == 'bottom') {
        y = e.bgY + ANCHOR * 2
      }

      this.g.translate(x, y)
    })

    this.on('map.mouseout', () => {
      if (!isActive) return

      this.g.attr({ visibility: 'hidden' })
      isActive = false
    })

    return this.g
  }
}

registerWidget('map.tooltip', MapTooltipWidget)
