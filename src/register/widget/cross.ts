// Port of legacy `src/widget/cross.js` ("chart.widget.cross", extend: "chart.widget.core") -
// extends `CoreWidget` directly. A crosshair overlay: two lines that follow the mouse across a
// configured axis, each with an optional balloon-tooltip label (`yFormat`/`xFormat`) showing the
// axis value under the cursor - built once (hidden) in `drawBefore()`, shown/hidden/moved via
// `axis.mouseover`/`axis.mouseout`/`axis.mousemove` listeners in `draw()`.
//
// **The y-line's tooltip is gated on `widget.yFormat` and the x-line's on `widget.xFormat`
// (literal, not a typo - each format option controls the OPPOSITE line's tooltip)**: confirmed by
// reading `drawBefore()` closely - the `xline`/`yTooltip` group (drawn when `yFormat` is a
// function) is the HORIZONTAL guide line (constant y, spanning the x-axis width) whose tooltip
// shows the crosshair's Y-AXIS value (`axis.y.invert(...)`, using `yFormat`) - i.e. `xline`/
// `yTooltip`/`yFormat` name the line by its ORIENTATION, not by which axis's value it displays.
// Reproduced with the exact same names/gating, not "fixed" into a more intuitive pairing.
import { CoreWidget, registerWidget } from 'jui-graph-ts'

const TW = 50
const TH = 18
const TA = TW / 10

/** `chart.widget.cross`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface CrossWidgetOptions {
  /** Which axis the crosshair tracks mouse movement over. */
  axis?: number
  /** Sets the format for the X-axis value shown on the tooltip - counter-intuitively, this gates
   * and formats the *horizontal* (y-constant) guide line's balloon, which displays the crosshair's
   * Y-axis value (see this file's header comment for the full naming explanation). */
  xFormat?: ((this: unknown, value: unknown) => unknown) | null
  /** Sets the format for the Y-axis value shown on the tooltip - gates and formats the *vertical*
   * (x-constant) guide line's balloon, which displays the crosshair's X-axis value. */
  yFormat?: ((this: unknown, value: unknown) => unknown) | null
}

/** Own `chart.widget.cross.setup()` fields - see legacy `cross.js`. */
export const CROSS_WIDGET_OWN_DEFAULTS: CrossWidgetOptions = {
  axis: 0,
  xFormat: null,
  yFormat: null,
}

export class CrossWidget extends CoreWidget {
  private pl = 0
  private pt = 0
  private g: any = null
  private xline: any = null
  private yline: any = null
  private xTooltip: any = null
  private yTooltip: any = null
  private tspan: any[] = []
  private crossAxis: any = null

  private printTooltip(index: number, text: any, message: unknown): void {
    if (!this.tspan[index]) {
      const elem = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      text.element.appendChild(elem)
      this.tspan[index] = elem
    }

    this.tspan[index].textContent = message
  }

  drawBefore = (): void => {
    const widget = this.widget as Record<string, unknown>
    const axis = (this.crossAxis = this.chart.axis(widget.axis as number))

    this.pl = this.chart.padding('left') + axis.area('x')
    this.pt = this.chart.padding('top') + axis.area('y')

    this.g = this.chart.svg
      .group({ visibility: 'hidden' }, () => {
        if (typeof widget.yFormat === 'function') {
          this.xline = this.chart.svg.line({
            x1: 0,
            y1: 0,
            x2: axis.area('width'),
            y2: 0,
            stroke: this.chart.theme('crossBorderColor'),
            'stroke-width': this.chart.theme('crossBorderWidth'),
            opacity: this.chart.theme('crossBorderOpacity'),
          })

          this.yTooltip = this.chart.svg
            .group({}, () => {
              this.chart.svg.polygon({
                fill: this.chart.theme('crossBalloonBackgroundColor'),
                'fill-opacity': this.chart.theme('crossBalloonBackgroundOpacity'),
                points: this.balloonPoints('left', TW, TH, TA),
              })

              this.chart.text({
                'font-size': this.chart.theme('crossBalloonFontSize'),
                fill: this.chart.theme('crossBalloonFontColor'),
                'text-anchor': 'middle',
                x: TW / 2,
                y: 12,
              })
            })
            .translate(-(TW + TA), 0)
        }

        if (typeof widget.xFormat === 'function') {
          this.yline = this.chart.svg.line({
            x1: 0,
            y1: 0,
            x2: 0,
            y2: axis.area('height'),
            stroke: this.chart.theme('crossBorderColor'),
            'stroke-width': this.chart.theme('crossBorderWidth'),
            opacity: this.chart.theme('crossBorderOpacity'),
          })

          this.xTooltip = this.chart.svg
            .group({}, () => {
              this.chart.svg.polygon({
                fill: this.chart.theme('crossBalloonBackgroundColor'),
                'fill-opacity': this.chart.theme('crossBalloonBackgroundOpacity'),
                points: this.balloonPoints('bottom', TW, TH, TA),
              })

              this.chart.text({
                'font-size': this.chart.theme('crossBalloonFontSize'),
                fill: this.chart.theme('crossBalloonFontColor'),
                'text-anchor': 'middle',
                x: TW / 2,
                y: 17,
              })
            })
            .translate(0, axis.area('height') + TA)
        }
      })
      .translate(this.pl, this.pt)
  }

  draw = (): any => {
    const widget = this.widget as Record<string, unknown>

    this.on(
      'axis.mouseover',
      () => {
        this.g.attr({ visibility: 'visible' })
      },
      widget.axis as number,
    )

    this.on(
      'axis.mouseout',
      () => {
        this.g.attr({ visibility: 'hidden' })
      },
      widget.axis as number,
    )

    this.on(
      'axis.mousemove',
      (e: { bgX: number; bgY: number; chartX: number; chartY: number }) => {
        this.g.attr({ visibility: 'visible' })
        const offset = 3

        const left = e.bgX - this.pl + offset
        const top = e.bgY - this.pt + offset

        if (this.xline) {
          this.xline.attr({ y1: top, y2: top })
        }

        if (this.yline) {
          this.yline.attr({ x1: left, x2: left })
        }

        if (this.yTooltip) {
          this.yTooltip.translate(-(TW + TA), top - TH / 2)

          const value = this.crossAxis.y.invert(e.chartY + offset)
          const message = (widget.yFormat as (this: unknown, value: unknown) => unknown).call(this.chart, value)
          this.printTooltip(0, this.yTooltip.get(1), message)
        }

        if (this.xTooltip) {
          this.xTooltip.translate(left - TW / 2, this.crossAxis.area('height') + TA)

          const value = this.crossAxis.x.invert(e.chartX + offset)
          const message = (widget.xFormat as (this: unknown, value: unknown) => unknown).call(this.chart, value)
          this.printTooltip(1, this.xTooltip.get(1), message)
        }
      },
      widget.axis as number,
    )

    return this.g
  }

  static setup(): Record<string, unknown> {
    return CROSS_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('cross', CrossWidget)
