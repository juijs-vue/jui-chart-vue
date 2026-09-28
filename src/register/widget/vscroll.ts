// Port of legacy `src/widget/vscroll.js` ("chart.widget.vscroll", extend: "chart.widget.core") -
// extends `CoreWidget` directly. The VERTICAL twin of `scroll.ts` (see that file's own header
// comment for the shared data-windowing model and the deliberate `bg.*`/`chart.*` dual-binding) -
// same logic, transposed to the y-axis/height (thumb moves top/bottom, thumb sits on the left or
// right edge of the chart rather than the top or bottom).
import { CoreWidget, registerWidget } from 'jui-graph-ts'

/** `chart.widget.vscroll`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface VScrollWidgetOptions {
  /** Which edge of the chart area the scrollbar track sits along. Only `'right'` is
   * special-cased; any other value places it on the left. */
  orient?: 'left' | 'right'
}

/** Own `chart.widget.vscroll.setup()` fields - see legacy `vscroll.js`. */
export const VSCROLL_WIDGET_OWN_DEFAULTS: VScrollWidgetOptions = {
  orient: 'left',
}

/** `chart.widget.vscroll` - a vertical scrollbar overlay: draws a track along the left (or, with
 * `orient: 'right'`, the right) edge of the chart area plus a draggable thumb sized proportionally
 * to the visible data window, and drags it to call `axis.zoom()` on every axis in the chart. The
 * vertical twin of `scroll.ts` - see that file's header comment for the shared data-windowing
 * model and dual `bg.*`/`chart.*` event binding, transposed here to y/height instead of x/width. */
export class VScrollWidget extends CoreWidget {
  private thumbHeight = 0
  private thumbTop = 0
  private bufferCount = 0
  private dataLength = 0
  private totalHeight = 0
  private piece = 0
  private rate = 0

  /** Vertical twin of `scroll.ts`'s `setScrollEvent()` - see that file's own doc comment for the
   * shared drag/clamp/zoom logic, transposed here to track `bgY`/height instead of `bgX`/width. */
  private setScrollEvent(thumb: any): void {
    let isMove = false
    let mouseStart = 0
    let thumbStart = 0
    const axies = this.chart.axis()

    const mousedown = (e: { target: unknown; bgY: number }) => {
      if (isMove && thumb.element !== e.target) return

      isMove = true
      mouseStart = e.bgY
      thumbStart = this.thumbTop
    }

    const mousemove = (e: { bgY: number }) => {
      if (!isMove) return

      let gap = thumbStart + e.bgY - mouseStart

      if (gap < 0) {
        gap = 0
      } else {
        if (gap + this.thumbHeight > this.chart.area('height')) {
          gap = this.chart.area('height') - this.thumbHeight
        }
      }

      thumb.translate(1, gap)
      this.thumbTop = gap

      const startgap = gap * this.rate
      let start = startgap === 0 ? 0 : Math.floor(startgap / this.piece)

      if (gap + this.thumbHeight === this.chart.area('height')) {
        start += 1
      }

      for (let i = 0; i < axies.length; i++) {
        axies[i].zoom(start, start + this.bufferCount)
      }

      if (!this.chart.isRender()) {
        this.chart.render()
      }
    }

    const mouseup = () => {
      if (!isMove) return

      isMove = false
      mouseStart = 0
      thumbStart = 0
    }

    this.on('bg.mousedown', mousedown)
    this.on('chart.mousedown', mousedown)
    this.on('bg.mousemove', mousemove)
    this.on('bg.mouseup', mouseup)
    this.on('chart.mousemove', mousemove)
    this.on('chart.mouseup', mouseup)
  }

  /** Vertical twin of `scroll.ts`'s `drawBefore()` - computes the thumb's proportional height/scale
   * from `this.axis`'s `origin`/`buffer`, using `chart.area('height')` in place of `width`. */
  drawBefore = (): void => {
    const axis = this.axis as unknown as { origin: unknown[]; buffer: number }

    this.dataLength = axis.origin.length
    this.bufferCount = axis.buffer
    this.piece = this.chart.area('height') / this.bufferCount
    this.totalHeight = this.piece * (this.dataLength || 1)
    this.rate = this.totalHeight / this.chart.area('height')
    this.thumbHeight = this.chart.area('height') * (this.bufferCount / (this.dataLength || 1)) + 2
  }

  /** Vertical twin of `scroll.ts`'s `draw()` - draws the track + thumb to the left (or, for
   * `widget.orient === 'right'`, the right) of the chart area, wiring drag behavior via
   * `setScrollEvent()`. Returns an empty group when there's no data (`dataLength === 0`). */
  draw = (): any => {
    const widget = this.widget as Record<string, unknown>
    const bgSize = this.chart.theme('scrollBackgroundSize') as number
    const bgX = widget.orient === 'right' ? this.chart.area('x2') : this.chart.area('x') - bgSize

    if (this.dataLength === 0) {
      return this.chart.svg.group()
    }

    return this.chart.svg
      .group({}, () => {
        this.chart.svg.rect({
          width: bgSize,
          height: this.chart.area('height'),
          fill: this.chart.theme('scrollBackgroundColor'),
        })

        const thumb = this.chart.svg
          .rect({
            width: bgSize - 2,
            height: this.thumbHeight,
            fill: this.chart.theme('scrollThumbBackgroundColor'),
            stroke: this.chart.theme('scrollThumbBorderColor'),
            cursor: 'pointer',
            'stroke-width': 1,
          })
          .translate(1, this.thumbTop)

        this.setScrollEvent(thumb)
      })
      .translate(bgX, this.chart.area('y'))
  }

  /** Supplies `VSCROLL_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return VSCROLL_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('vscroll', VScrollWidget)
