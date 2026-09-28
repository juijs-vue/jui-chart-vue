// Port of legacy `src/brush/patternbar.js` ("chart.brush.patternbar", extend:
// "chart.brush.imagebar") - extends `ImageBarBrush` (confirmed from the legacy file's own
// `extend:` field), reusing its inherited `getImageURI()` but overriding `drawBefore()`/`draw()`
// completely: instead of an `<image>`+optional-backing-`<rect>` per cell (`imagebar.ts`'s own
// approach), this fills a single `<rect>` per cell with an SVG `<pattern>` (one freshly `<defs>`-
// registered pattern per cell, via its own new `createPattern()`) tiling `brush.uri`'s image.
import { registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'
import { ImageBarBrush } from './imagebar'
import type { ImageBarBrushOptions } from './imagebar'

/** `chart.brush.patternbar`'s own config fields (on top of the inherited `ImageBarBrushOptions` -
 * `fixed` doesn't apply here, since pattern tiling has no "stretch vs. fixed-size" distinction). */
export interface PatternBarBrushOptions extends Omit<ImageBarBrushOptions, 'fixed'> {
  /** Gap in px between adjacent bars within the same row. */
  innerPadding?: number
  /** Pattern tile width in px. */
  width?: number
  /** Pattern tile height in px. */
  height?: number
  /** Pattern tile image URL: a fixed string, or a function of `(key, value)` returning one. */
  uri?: string | ((this: unknown, key: string, value: unknown) => string) | null
}

/** Own `chart.brush.patternbar.setup()` fields - see legacy `patternbar.js`. */
export const PATTERNBAR_BRUSH_OWN_DEFAULTS: PatternBarBrushOptions = {
  innerPadding: 2,
  width: 0,
  height: 0,
  uri: null,
}

/** Generates a probably-unique DOM id by joining `key` (or `'id'`) with the current timestamp and
 * a random 0-99 suffix - used as each generated `<pattern>`'s id. Not exported; internal to this
 * file. */
function createId(key?: string): string {
  return [key || 'id', +new Date(), Math.round(Math.random() * 100) % 100].join('-')
}

export class PatternBarBrush extends ImageBarBrush {
  /** Registers a new SVG `<pattern>` (a freshly-generated, effectively-unique id from `createId`)
   * tiling an `<image>` (resolved via the inherited `getImageURI(key, value)`) at the given
   * `width`/`height`, appends it to the chart's shared `<defs>` (`chart.appendDefs()`), and returns
   * its id for use as a `fill: 'url(#id)'` reference. Called once per drawn cell (no pattern
   * reuse/dedup across cells, even for identical `key`/`value` pairs). */
  createPattern(width: number, height: number, key: string, value: unknown): string {
    const id = createId('pattern-')
    const pattern = this.chart.svg.pattern({
      id,
      x: 0,
      y: 0,
      width,
      height,
      patternUnits: 'userSpaceOnUse',
    })
    const image = this.chart.svg.image({
      width,
      height,
      'xlink:href': this.getImageURI(key, value),
    })

    pattern.append(image)
    ;(this.chart as unknown as { appendDefs(elem: unknown): void }).appendDefs(pattern)

    return id
  }

  /** Same field-caching logic as the inherited `ImageBarBrush.drawBefore` (zero-x, row band
   * height, tile `colWidth`/`colHeight`, and the combined `halfHeight` of one row's stacked
   * tiles) - redeclared here (rather than reusing the parent method as-is) purely because
   * `PatternBarBrush` overrides `draw()` too and both methods read the same cached fields. */
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

  /** Arrow-function class field satisfying `Draw.render()`'s required `draw` hook. For each row
   * and target field, generates a fresh tiling pattern (`createPattern()`) and fills a single
   * `<rect>` sized to the resolved bar length with it (`fill: 'url(#...)'`) - unlike
   * `ImageBarBrush.draw`, there's no `fixed`-vs-stretch distinction, since pattern tiling doesn't
   * need one. Rows whose value is `0` skip `addEvent()`, same as `ImageBarBrush.draw`. */
  draw = (): any => {
    this.eachData((data, i) => {
      const row = data as BrushData
      const index = i as number
      let startY = this.offset('y', index) - this.halfHeight / 2

      for (let j = 0; j < this.targets.length; j++) {
        const value = row[this.targets[j]]
        const patternId = this.createPattern(this.colWidth, this.colHeight, this.targets[j], value)
        const startX = (this.axis.x as BrushAxisScale)(value)
        const width = Math.abs(this.zeroX - startX)

        const r = this.chart.svg.rect({
          width,
          height: this.colHeight,
          fill: 'url(#' + patternId + ')',
          'stroke-width': 0,
        })

        if (value != 0) {
          this.addEvent(r, index, j)
        }

        if (startX >= this.zeroX) {
          r.translate(this.zeroX, startY)
        } else {
          r.translate(this.zeroX - width, startY)
        }

        this.g.append(r)

        startY += this.colHeight + this.padding
      }
    })

    return this.g
  }

  /** Returns this brush's own config defaults (`PATTERNBAR_BRUSH_OWN_DEFAULTS`) for
   * `builder.ts`'s `defineOptions()` merge chain. */
  static setup(): Record<string, unknown> {
    return PATTERNBAR_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('patternbar', PatternBarBrush)
