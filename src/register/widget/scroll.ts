// Port of legacy `src/widget/scroll.js` ("chart.widget.scroll", extend: "chart.widget.core") -
// extends `CoreWidget` directly. A horizontal scrollbar thumb: `axis.origin`/`axis.buffer` (a real
// data-windowing feature - `origin` is the FULL dataset, `buffer` the visible window size) drive
// the thumb's proportional width, and dragging it calls `axis.zoom(start, end)` on every axis in
// the chart to shift the visible window, re-rendering on every drag `mousemove`.
//
// **Mixed `bg.*`/`chart.*` mouse events, both wired to the SAME handlers** - literal to the
// source: `mousedown`/`mousemove`/`mouseup` are each bound to BOTH a `"bg.*"` and a `"chart.*"`
// event name (`self.on("bg.mousedown", mousedown); self.on("chart.mousedown", mousedown);`, etc) -
// not a redundant duplicate, since `Builder`'s own mouse handling emits `bg.*` for the chart
// background specifically and `chart.*` more broadly (see `base/builder.ts`'s mouse-event wiring),
// so this genuinely listens on two distinct event sources with one shared handler.
import { CoreWidget, registerWidget } from 'jui-graph-ts'

/** `chart.widget.scroll`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface ScrollWidgetOptions {
  /** Which edge of the chart area the scrollbar track sits along. Only `'top'` is special-cased
   * (placed above the chart area); any other value places it below. */
  orient?: 'top' | 'bottom'
}

/** Own `chart.widget.scroll.setup()` fields - see legacy `scroll.js`. */
export const SCROLL_WIDGET_OWN_DEFAULTS: ScrollWidgetOptions = {
  orient: 'bottom',
}

export class ScrollWidget extends CoreWidget {
  private thumbWidth = 0
  private thumbLeft = 0
  private bufferCount = 0
  private dataLength = 0
  private totalWidth = 0
  private piece = 0
  private rate = 0

  /** Wires the scrollbar thumb's drag behavior: `mousedown` on either the thumb OR the chart/
   * background starts a drag (see this file's header comment on the deliberate dual `bg.*`/
   * `chart.*` binding), `mousemove` clamps the thumb's translated x to `[0, chart.area('width') -
   * thumbWidth]`, converts that position back into a data-index `start` via `this.rate`/`this.piece`
   * (nudging `start` up by one when the thumb is flush against the right edge, to land on the last
   * whole window rather than one short of it), and calls `axis.zoom(start, start + bufferCount)` on
   * every axis in the chart, force-rendering if a render isn't already pending; `mouseup` just
   * resets the drag-tracking state. */
  private setScrollEvent(thumb: any): void {
    let isMove = false
    let mouseStart = 0
    let thumbStart = 0
    const axies = this.chart.axis()

    const mousedown = (e: { target: unknown; bgX: number }) => {
      if (isMove && thumb.element !== e.target) return

      isMove = true
      mouseStart = e.bgX
      thumbStart = this.thumbLeft
    }

    const mousemove = (e: { bgX: number }) => {
      if (!isMove) return

      let gap = thumbStart + e.bgX - mouseStart

      if (gap < 0) {
        gap = 0
      } else {
        if (gap + this.thumbWidth > this.chart.area('width')) {
          gap = this.chart.area('width') - this.thumbWidth
        }
      }

      thumb.translate(gap, 1)
      this.thumbLeft = gap

      const startgap = gap * this.rate
      let start = startgap === 0 ? 0 : Math.floor(startgap / this.piece)

      if (gap + this.thumbWidth === this.chart.area('width')) {
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

  /** Computes the thumb's proportional width/scale from `this.axis`'s `origin` (the full dataset)
   * vs. `buffer` (the visible window size): `piece` is one data-index's worth of track width,
   * `rate` converts a track pixel position back to the full-dataset's pixel scale, and `thumbWidth`
   * is sized so its share of the track matches `buffer / dataLength` (plus a 2px fudge). */
  drawBefore = (): void => {
    const axis = this.axis as unknown as { origin: unknown[]; buffer: number }

    this.dataLength = axis.origin.length
    this.bufferCount = axis.buffer
    this.piece = this.chart.area('width') / this.bufferCount
    this.totalWidth = this.piece * (this.dataLength || 1)
    this.rate = this.totalWidth / this.chart.area('width')
    this.thumbWidth = this.chart.area('width') * (this.bufferCount / (this.dataLength || 1)) + 2
  }

  /** Draws the scrollbar track + draggable thumb below (or, for `widget.orient === 'top'`, above)
   * the chart area, and wires the thumb's drag behavior via `setScrollEvent()`. Returns an empty
   * group with nothing drawn when there's no data to scroll through (`dataLength === 0`). */
  draw = (): any => {
    const widget = this.widget as Record<string, unknown>
    const bgSize = this.chart.theme('scrollBackgroundSize') as number
    const bgY = widget.orient === 'top' ? this.chart.area('y') - bgSize : this.chart.area('y2')

    if (this.dataLength === 0) {
      return this.chart.svg.group()
    }

    return this.chart.svg
      .group({}, () => {
        this.chart.svg.rect({
          width: this.chart.area('width'),
          height: bgSize,
          fill: this.chart.theme('scrollBackgroundColor'),
        })

        const thumb = this.chart.svg
          .rect({
            width: this.thumbWidth,
            height: bgSize - 2,
            fill: this.chart.theme('scrollThumbBackgroundColor'),
            stroke: this.chart.theme('scrollThumbBorderColor'),
            cursor: 'pointer',
            'stroke-width': 1,
          })
          .translate(this.thumbLeft, 1)

        this.setScrollEvent(thumb)
      })
      .translate(this.chart.area('x'), bgY)
  }

  /** Supplies `SCROLL_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return SCROLL_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('scroll', ScrollWidget)
