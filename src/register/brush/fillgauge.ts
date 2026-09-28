// Port of the REAL legacy `chart.brush.fillgauge` ("chart.brush.fillgauge", extend:
// "chart.brush.core") - found via `git clone https://github.com/juijs/jui-chart.git` -> the repo's
// own `legacy` branch (also present in every `v2.0.x` tag), at `js/brush/fillgauge.js`. Not on
// `master`, not in the npm-published `juijs-chart@2.6.12` tarball - but confirmed byte-identical
// logic (just identifier-renamed) in `www.jui-vue.io/lib/jui/js/chart.min.js`
// (`jui.define("chart.brush.fillgauge",...)`), which is itself confirmed byte-identical to
// `chartplay.jui.io/lib/jui/js/chart.min.js` via `md5sum`. A real, authentic original - not a
// reverse-engineered reconstruction.
//
// Two deliberate deviations from a strictly literal port, both documented here rather than
// silently "fixed":
//
// 1. The legacy `drawBefore` reads `var axis = axis || {}` at its very first line - a classic JS
//    `var`-hoisting shadow bug: the local `var axis` declaration shadows the constructor's own
//    `axis` parameter FOR THE ENTIRE FUNCTION BODY (from the very first read), so at the point
//    `axis || {}` evaluates, the (hoisted, not-yet-assigned) local `axis` is always `undefined` -
//    meaning this line ALWAYS evaluates to `{}`, never the real axis, regardless of what's passed
//    in. Node-verified (`var axis = axis || {}` inside a function whose param is also named
//    `axis`, called with a real object, still produces `{}`). Confirmed present verbatim in the
//    actual shipped `chart.min.js` too (`var c=c||{}` in the minified `drawBefore`, `c` being this
//    brush's own minified `axis` param name). Since this project's classes use `this.axis` (set
//    externally post-construction by `Builder.drawBrush()`, exactly like the original) rather than
//    a constructor-closure `axis` parameter at all, this shadow bug has no TS equivalent to
//    replicate - `this.axis` here is simply the real axis, unconditionally. Nothing to preserve.
// 2. Because of bug #1, the real engine's `axis.c()` call in `drawBefore` would always throw
//    (`{}.c is not a function`) UNLESS a real `axis.c()` happens to already exist independently -
//    which never happens for this brush, since none of this project's `fillgauge`-using demos
//    (`fill_gauge`/`fill_custom_gauge`) configure a `c`-type axis panel. The sibling brush in the
//    very same original file (`chart.brush.stackgauge`, extends the same `chart.brush.donut`
//    family) hits the identical "no configured `c` panel" situation and guards it explicitly:
//    `if (!axis.c) { axis.c = function() { return {x:0,y:0,width:chart.area('width'),
//    height:chart.area('height')}; }; }` (see `stackgauge.ts`). `fillgauge.js` is simply missing
//    that same guard - an omission, not an intentional difference (both brushes need exactly the
//    same "no configured axis -> synthesize a full-chart-area panel" fallback for a single, sized,
//    centered gauge shape). Applying `stackgauge`'s own precedent here (rather than either
//    replicating a guaranteed crash, or silently doing nothing) is the smallest change that makes
//    this brush actually render, using a pattern the original codebase itself already establishes.
import { CoreBrush, registerBrush } from 'jui-graph-ts'

type CAxis = () => { width: number; height: number; x: number; y: number }

/** Generates a reasonably-unique DOM id (`key-timestamp-random`) for this brush's `<clipPath>`,
 * so multiple fill gauges on the same page don't collide on the same clip id. */
function createId(key?: string): string {
  return [key || 'id', +new Date(), Math.round(Math.random() * 100) % 100].join('-')
}

/** `chart.brush.fillgauge`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface FillGaugeBrushOptions {
  /** Determines the minimum value of a fill gauge. */
  min?: number
  /** Determines the maximum value of a fill gauge. */
  max?: number
  /** Determines the current value of a fill gauge. */
  value?: number
  /** Determines the shape of a fill gauge (`'circle'`, `'rectangle'`). */
  shape?: 'circle' | 'rectangle'
  /** Determines the direction in which a fill gauge is to be filled (`'vertical'`,
   * `'horizontal'`). */
  direction?: 'vertical' | 'horizontal'
  /** Sets the shape of a fill gauge with a specified URL to an external SVG. */
  svg?: string
  /** Sets the shape of a fill gauge with a specified `<path>` `d` attribute string. */
  path?: string
}

/** Own `chart.brush.fillgauge.setup()` fields - see legacy `fillgauge.js`. */
export const FILLGAUGE_BRUSH_OWN_DEFAULTS: FillGaugeBrushOptions = {
  min: 0,
  max: 100,
  value: 0,
  shape: 'circle',
  direction: 'vertical',
  svg: '',
  path: '',
}

/** `chart.brush.fillgauge`: renders a single gauge shape (`'circle'`, `'rectangle'`, or a custom
 * `brush.path`/`brush.svg` shape) whose fill level - clipped via a `<clipPath>` rect sized by
 * `(value - min) / (max - min)` - rises from the bottom (`direction: 'vertical'`) or from the left
 * (`'horizontal'`). See this file's own header comment for two documented deviations from a literal
 * port: a legacy `var`-hoisting shadow bug that has no TS equivalent to replicate, and a borrowed
 * `stackgauge`-style fallback that synthesizes a full-chart-area panel when no `axis.c()` grid is
 * configured. Also fixes a genuine legacy bug (documented inline on the circle's foreground fill)
 * that made the circle shape's fill permanently invisible. */
export class FillGaugeBrush extends CoreBrush {
  private fgW = 0
  private fgCenterX = 0
  private fgCenterY = 0
  private fgOuterRadius = 0
  private fgClipId = ''
  private fgRect: any

  /** Sizes/positions the hidden clip rect (`fgRect`) that determines how much of the gauge's shape
   * is "filled": `rate = (value - min) / (max - min)` of the chart's own plot area, growing upward
   * from the bottom when `direction === 'vertical'` (a rect anchored at `y = area.height - height`)
   * or growing rightward from the left otherwise (`'horizontal'`, full height, partial width). */
  private setDirection(direction: unknown): void {
    const brush = this.brush as Record<string, unknown>
    const rate = ((brush.value as number) - (brush.min as number)) / ((brush.max as number) - (brush.min as number))

    let width: number
    let height: number
    let x: number
    let y: number

    if (direction == 'vertical') {
      height = (this.chart.area('height') as number) * rate
      width = this.chart.area('width') as number
      x = 0
      y = (this.chart.area('height') as number) - height
    } else {
      // horizontal
      height = this.chart.area('height') as number
      width = (this.chart.area('width') as number) * rate
      x = 0
      y = 0
    }

    this.fgRect.attr({ x, y, width, height })
  }

  /** Renders a custom `brush.path`-shaped gauge: a background copy of the path (theme background
   * color) plus a foreground copy filled with `color(0)` and clipped by `fgRect` via the shared
   * `fgClipId`, so `setDirection()`'s rect reveals only the filled portion of the custom shape. */
  private createPath(group: any, path: unknown): void {
    group.append(
      this.chart.svg.path({
        x: 0,
        y: 0,
        fill: this.chart.theme('gaugeBackgroundColor'),
        d: path,
      }),
    )

    group.append(
      this.chart.svg.path({
        x: 0,
        y: 0,
        fill: this.color(0),
        d: path,
        'clip-path': 'url(#' + this.fgClipId + ')',
      }),
    )
  }

  /** Sets up this render pass's shared geometry and clip path. First synthesizes a full-chart-area
   * `axis.c()` panel fallback when none is configured (see header comment item 2 - a fix borrowed
   * from `stackgauge.ts`'s own identical guard, since the legacy source assumes one always exists).
   * Then derives the gauge's center (`fgCenterX`/`fgCenterY`) and radius (`fgW`/`fgOuterRadius`,
   * half of the panel's shorter side) from that panel, and creates a `<clipPath>` (with a
   * fresh `fgClipId` via `createId()`) containing the zero-sized `fgRect` that `setDirection()`
   * resizes each render to reveal the "filled" portion of the gauge shape. */
  drawBefore = (): void => {
    // See header comment item 2: the legacy source assumes `axis.c()` already exists
    // unconditionally (no demo actually configures a `c`-type axis panel for this brush) - the
    // sibling `stackgauge.js` guards the identical situation this same way.
    if (!this.axis.c) {
      ;(this.axis as unknown as { c: CAxis }).c = () => ({
        x: 0,
        y: 0,
        width: this.chart.area('width') as number,
        height: this.chart.area('height') as number,
      })
    }

    const obj = (this.axis.c as unknown as CAxis)()
    const width = obj.width
    const height = obj.height
    const x = obj.x
    const y = obj.y
    let min = width

    if (height < min) {
      min = height
    }

    this.fgW = min / 2
    this.fgCenterX = width / 2 + x
    this.fgCenterY = height / 2 + y
    this.fgOuterRadius = this.fgW
    this.fgClipId = createId('fill-gauge')

    const clip = this.chart.svg.clipPath({ id: this.fgClipId })

    this.fgRect = this.chart.svg.rect({ x: 0, y: 0, width: 0, height: 0 })

    clip.append(this.fgRect)
    ;(this.chart as unknown as { appendDefs(elem: unknown): void }).appendDefs(clip)
  }

  /** Renders the gauge: calls `setDirection()` to size the fill clip rect, then draws either a
   * custom `brush.path` shape (via `createPath()`; the legacy `brush.svg`-URL-fetch branch is dead
   * code in the original itself, preserved as such), or a built-in `'circle'`/`'rectangle'` shape -
   * each as a background copy (theme background color) plus a foreground copy filled with
   * `color(0)` and clipped to the fill rect. See the inline comment on the circle's foreground fill
   * for a genuine bug fix: the legacy source's `chart.color(0, brush)` call there always resolved
   * to `"none"` (permanently invisible), so it's replaced with the same `this.color(0)` form every
   * other branch/brush already uses. */
  draw = (): any => {
    const group = this.chart.svg.group({ opacity: 0.8 })
    const brush = this.brush as Record<string, unknown>

    this.setDirection(brush.direction)

    if (brush.svg != '' || brush.path != '') {
      if (brush.svg != '') {
        // Legacy `$.ajax(...)`-based synchronous SVG-URL fetch is commented out (`/*/ ... /**/`)
        // in the original source itself - a dead branch there too, not something this port drops.
      } else {
        this.createPath(group, brush.path)
      }
    } else {
      if (brush.shape == 'circle') {
        group.append(
          this.chart.svg.circle({
            cx: this.fgCenterX,
            cy: this.fgCenterY,
            r: this.fgOuterRadius,
            fill: this.chart.theme('gaugeBackgroundColor'),
          }),
        )

        group.append(
          this.chart.svg.circle({
            cx: this.fgCenterX,
            cy: this.fgCenterY,
            r: this.fgOuterRadius,
            // BUGFIX (genuine bug, not a preserved quirk): the legacy source calls
            // `chart.color(0, brush)` here specifically - passing the WHOLE brush OPTIONS object as
            // the 2-arg `color()`'s `colors` array/object to index by key `0`. `CoreBrush`'s own
            // `Builder.color()` (`chart.color(key, colors)`) only treats `colors` as an
            // array/object to READ (`colors[key]`) - a brush options object has no numeric `"0"`
            // key, so this always evaluates to `undefined`, and `Builder`'s own `createColor()`
            // explicitly maps `undefined` to the literal string `"none"` (Node/hand-verified against
            // both this port's `builder.ts` and the shipped `chart.min.js`, byte-identical logic) -
            // making the "filled" circle permanently invisible, for every real usage, not a corner
            // case. The sibling `rectangle` branch two cases below calls the correct, ordinary
            // `this.color(0)` (this class's own inherited `CoreBrush.color()`, which correctly reads
            // `this.brush.colors` internally) - every other brush in this whole codebase uses that
            // same 1-arg form. Using it here too (instead of faithfully reproducing a bug that would
            // make this shape's core feature never work, ever) is the smallest fix that makes the
            // brush's own explicitly-declared default (`shape: "circle"`) actually render.
            fill: this.color(0),
            'clip-path': 'url(#' + this.fgClipId + ')',
          }),
        )
      } else if (brush.shape == 'rectangle') {
        group.append(
          this.chart.svg.rect({
            x: 0,
            y: 0,
            width: this.chart.area('width') as number,
            height: this.chart.area('height') as number,
            fill: this.chart.theme('gaugeBackgroundColor'),
          }),
        )

        group.append(
          this.chart.svg.rect({
            x: 0,
            y: 0,
            width: this.chart.area('width') as number,
            height: this.chart.area('height') as number,
            fill: this.color(0),
            'clip-path': 'url(#' + this.fgClipId + ')',
          }),
        )
      }
    }

    return group
  }

  /** Returns this brush's own default options (`min`/`max`/`value`/`shape`/`direction`/`svg`/
   * `path`), merged by `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return FILLGAUGE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('fillgauge', FillGaugeBrush)
