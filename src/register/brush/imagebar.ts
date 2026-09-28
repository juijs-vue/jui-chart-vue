// Port of legacy `src/brush/imagebar.js` ("chart.brush.imagebar", extend: "chart.brush.core") - a
// horizontal bar brush whose "bar" is an `<image>` (via `brush.uri`, a string or a
// `(key,value)=>string` callback), either stretched (scaled) to the bar's own length or - when
// `fixed: true` (the default) - kept at its configured `width`/`height` with the REMAINING length
// filled by a plain colored `<rect>` behind it. Base class for `patternbar.ts`/`imagecolumn.ts`
// (both `extend: "chart.brush.imagebar"`), which reuse `getBarStyle()`/`getImageURI()` unchanged.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.imagebar`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface ImageBarBrushOptions {
  /** Gap in px between adjacent bars within the same row. */
  innerPadding?: number
  /** Fixed image width in px, used when `fixed: true`. */
  width?: number
  /** Fixed image height in px, used when `fixed: true`. */
  height?: number
  /** Keeps the image at its configured `width`/`height` with the remaining bar length filled by
   * a plain colored rect (`true`), or stretches the image to the bar's full length (`false`). */
  fixed?: boolean
  /** Image URL: a fixed string, or a function of `(key, value)` returning one; `null` renders no
   * image. */
  uri?: string | ((this: unknown, key: string, value: unknown) => string) | null
}

/** Own `chart.brush.imagebar.setup()` fields - see legacy `imagebar.js`. */
export const IMAGEBAR_BRUSH_OWN_DEFAULTS: ImageBarBrushOptions = {
  innerPadding: 2,
  width: 0,
  height: 0,
  fixed: true,
  uri: null,
}

export class ImageBarBrush extends CoreBrush {
  protected g: any
  protected targets: string[] = []
  protected padding = 0
  protected zeroX = 0
  protected height = 0
  protected halfHeight = 0
  protected colWidth = 0
  protected colHeight = 0

  getImageURI(key: string, value: unknown): string {
    let uri = (this.brush as Record<string, unknown>).uri as string | ((this: unknown, key: string, value: unknown) => string) | null

    if (typeof uri === 'function') {
      uri = uri.apply(this.chart, [key, value])
    }

    return uri as string
  }

  getBarStyle(): { borderColor: unknown; borderWidth: unknown; borderOpacity: unknown } {
    return {
      borderColor: this.chart.theme('barBorderColor'),
      borderWidth: this.chart.theme('barBorderWidth'),
      borderOpacity: this.chart.theme('barBorderOpacity'),
    }
  }

  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>

    this.g = this.chart.svg.group()
    this.targets = (brush.target ?? []) as string[]
    this.padding = brush.innerPadding as number
    this.zeroX = (this.axis.x as BrushAxisScale)(0)
    this.height = (this.axis.y as BrushAxisScale).rangeBand!()
    this.colWidth = brush.width as number
    this.colHeight = brush.height as number
    this.halfHeight = this.colHeight * this.targets.length + (this.targets.length - 1) * this.padding
  }

  draw = (): any => {
    const brush = this.brush as Record<string, unknown>

    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      let startY = this.offset('y', index) - this.halfHeight / 2

      for (let j = 0; j < this.targets.length; j++) {
        const value = row[this.targets[j]]
        const startX = (this.axis.x as BrushAxisScale)(value)
        const width = Math.abs(this.zeroX - startX)

        const bar = this.chart.svg.group({}, () => {
          const img = this.chart.svg.image({
            width: this.colWidth,
            height: this.colHeight,
            'xlink:href': this.getImageURI(this.targets[j], value),
          })

          if (brush.fixed) {
            let w = width - this.colWidth
            const style = this.getBarStyle()

            if (w < 0) w = 0

            this.chart.svg.rect({
              width: w,
              height: this.colHeight,
              fill: this.color(index, j),
              stroke: style.borderColor,
              'stroke-width': style.borderWidth,
              'stroke-opacity': style.borderOpacity,
            })

            img.translate(w, 0)
          } else {
            if (width > 0 && this.colWidth > 0) {
              img.scale(width > this.colWidth ? width / this.colWidth : this.colWidth / width, 1)
            }
          }
        })

        if (value != 0) {
          this.addEvent(bar, index, j)
        }

        if (startX >= this.zeroX) {
          bar.translate(this.zeroX, startY)
        } else {
          bar.translate(this.zeroX - width, startY)
        }

        this.g.append(bar)

        startY += this.colHeight + this.padding
      }
    })

    return this.g
  }

  static setup(): Record<string, unknown> {
    return IMAGEBAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('imagebar', ImageBarBrush)
