// Port of legacy `src/widget/title.js` ("chart.widget.title", extend: "chart.widget.core"). Note:
// legacy `TitleWidget`'s own `widget.axis` option is a lookup into `chart.axis(widget.axis)` - a
// DIFFERENT axis than `this.axis` (which `base/builder.ts`'s `drawWidget()` always wires to
// `this._axis[0]`, axis 0, regardless of any widget config) - preserved exactly here.
import { CoreWidget, registerWidget } from 'jui-graph-ts'

const TOP_PADDING = 25
const PADDING = 20

/** `chart.widget.title`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface TitleWidgetOptions {
  /** Which axis to position the title relative to (looked up via `chart.axis(axis)` - a
   * different axis than the widget's own `this.axis`, which is always axis 0). `null` falls
   * back to positioning against the whole chart area instead of a specific axis. */
  axis?: number | null
  /** Vertical placement: above the axis, vertically centered (rotated for start/end align), or
   * below the axis. */
  orient?: 'top' | 'center' | 'bottom'
  /** Horizontal placement within the axis width. */
  align?: 'start' | 'middle' | 'end'
  /** The title text itself. */
  text?: string
  /** Extra x offset in px, applied after position calculation. */
  dx?: number
  /** Extra y offset in px, applied after position calculation. */
  dy?: number
  /** Font size override; falls back to the theme's `titleFontSize` when `null`. */
  size?: number | null
  /** Font color override; falls back to the theme's `titleFontColor` when `null`. */
  color?: string | null
}

/** Own `chart.widget.title.setup()` fields - see legacy `title.js`. */
export const TITLE_WIDGET_OWN_DEFAULTS: TitleWidgetOptions = {
  axis: null,
  orient: 'top',
  align: 'middle',
  text: '',
  dx: 0,
  dy: 0,
  size: null,
  color: null,
}

/** `chart.widget.title` - draws a positioned text title, either against a specific axis
 * (`widget.axis`, looked up via `chart.axis(axis)`) or against the whole chart area when `axis` is
 * `null`, placed by `widget.orient`/`align` with optional `dx`/`dy` offsets and font `size`/`color`
 * overrides. See this file's header comment: `widget.axis` is a distinct lookup from the widget's
 * own inherited `this.axis`, which `drawWidget()` always wires to axis 0 regardless of config. */
export class TitleWidget extends CoreWidget {
  // `this.chart` is already typed as `WidgetChart` by `CoreWidget` itself (`widget/core.ts`) - no
  // override needed here.
  private x = 0
  private y = 0
  private anchor = 'middle'

  /** Computes `this.x`/`this.y`/`this.anchor` from `widget.orient`/`widget.align` before `draw()`
   * runs. When `widget.axis` resolves to a real axis, positions relative to that axis's own area/
   * padding (see this file's own header comment on the `widget.axis` vs `this.axis` distinction);
   * otherwise falls back to the deprecated whole-chart-area positioning branch below. */
  drawBefore = (): void => {
    const chart = this.chart
    const widget = this.widget as Record<string, unknown>
    const axis = chart.axis(widget.axis as number)

    if (axis) {
      if (widget.orient == 'bottom') {
        this.y = axis.area('y2') + axis.padding('bottom') - PADDING
      } else if (widget.orient == 'top') {
        this.y = axis.area('y') - axis.padding('top') + TOP_PADDING
      } else {
        this.y = axis.area('y') + axis.area('height') / 2
      }

      if (widget.align == 'middle') {
        this.x = axis.area('x') + axis.area('width') / 2
        this.anchor = 'middle'
      } else if (widget.align == 'start') {
        this.x = axis.area('x') - axis.padding('left') + PADDING
        this.anchor = 'start'
      } else {
        this.x = axis.area('x2') + axis.padding('right') - PADDING
        this.anchor = 'end'
      }

      this.x += chart.area('x')
      this.y += chart.area('y')
    } else {
      // @Deprecated - legacy fallback for a non-axis-based chart, preserved verbatim.
      if (widget.orient == 'bottom') {
        this.y = chart.area('y2') + chart.padding('bottom') - PADDING
      } else if (widget.orient == 'top') {
        this.y = PADDING
      } else {
        this.y = chart.area('y') + chart.area('height') / 2
      }

      if (widget.align == 'middle') {
        this.x = chart.area('x') + chart.area('width') / 2
        this.anchor = 'middle'
      } else if (widget.align == 'start') {
        this.x = chart.area('x')
        this.anchor = 'start'
      } else {
        this.x = chart.area('x2')
        this.anchor = 'end'
      }
    }
  }

  /** Draws `widget.text` at the position `drawBefore()` computed, colored/sized from
   * `widget.color`/`widget.size` (falling back to the theme's `titleFontColor`/`titleFontSize`).
   * When `orient` is `'center'` and `align` is `'start'`/`'end'`, additionally rotates the text
   * -90°/90° around its own midpoint so it reads vertically alongside the axis. */
  draw = (): any => {
    const chart = this.chart
    const widget = this.widget as Record<string, unknown>
    const obj = chart.svg.getTextSize(widget.text as string)

    const half_text_width = obj.width / 2
    const half_text_height = obj.height / 2

    const text = chart.text(
      {
        x: this.x + (widget.dx as number),
        y: this.y + (widget.dy as number),
        'text-anchor': this.anchor,
        fill: widget.color || chart.theme('titleFontColor'),
        'font-size': widget.size || chart.theme('titleFontSize'),
        'font-weight': chart.theme('titleFontWeight'),
      },
      widget.text as string,
    )

    if (widget.orient == 'center') {
      if (widget.align == 'start') {
        text.rotate(-90, this.x + (widget.dx as number) + half_text_width, this.y + (widget.dy as number) + half_text_height)
      } else if (widget.align == 'end') {
        text.rotate(90, this.x + (widget.dx as number) - half_text_width, this.y + (widget.dy as number) + half_text_height)
      }
    }

    return text
  }

  /** Supplies `TITLE_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return TITLE_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('title', TitleWidget)
