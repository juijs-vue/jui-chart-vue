// Port of legacy `src/brush/canvas/base/bubble.js` ("util.canvas.base.bubble", extend:
// "util.canvas.base.kinetic") - a single labeled, physics-driven circle used by
// `canvas/bubblecloud.js` (`chart.brush.canvas.bubblecloud`). `Bubble extends KineticObject`
// (confirmed from the legacy file's own `extend` field), reusing its `pos`/`force`/`update`/
// `distance`/`distancePos` fields/methods wholesale - only `draw()` (plus the constructor's own
// display fields: `mark`/`dim`/`radius`/`text`/`color`/`shadowColor`/`textColor`) is new here.
//
// `mark`/`dim`/`data`/`pos` (the latter inherited from `KineticObject`) are all mutated directly
// by the owning `BubbleCloud` (`bubblecloud.ts`) after construction (`bubble.data = e`, `bubble.mark
// = true`, `bubble.pos = [...]`, `bubble.dim = ...`) - kept as plain public fields here, matching
// the original's own untyped `this.foo = ...` shape, not encapsulated behind accessors.
import { canvasBaseUtil } from 'jui-graph-ts'
import { KineticObject } from './kinetic'

/** A single labeled, physics-driven circle used by `canvas.bubblecloud`'s `BubbleCloud` helper.
 * Extends `KineticObject`, reusing its `pos`/`force`/`update`/`distance`/`distancePos` wholesale;
 * adds only `draw()` (a drop-shadowed filled circle with centered `text`, dimmable via `dim`) plus
 * the display fields (`mark`/`dim`/`radius`/`text`/`color`/`shadowColor`/`textColor`) the owning
 * `BubbleCloud` mutates directly after construction. */
export class Bubble extends KineticObject {
  mark = false
  dim = false
  radius: number
  text: string
  color: string
  shadowColor: string
  textColor: string
  private textStyle: string

  /** Set by the owning `BubbleCloud` after construction (`bubble.data = e`) - the original data
   * row this bubble represents, read back out via `BubbleCloud.pick()`'s `.data.origin`. Left
   * `unknown` here (never read by this class itself). */
  data: unknown

  constructor(
    radius: number,
    text: string,
    color = '#497eff',
    shadowColor = 'rgba(16,116,252,0.2)',
    textColor = '#fff',
    textStyle = 'bold 11px Noto Sans KR',
  ) {
    super()
    this.radius = radius
    this.text = text
    this.color = color
    this.shadowColor = shadowColor
    this.textColor = textColor
    this.textStyle = textStyle
  }

  /** Renders this bubble as a drop-shadowed filled circle at its current `pos` (via `jui-graph-ts`'s
   * `CanvasBase.drawCircle`) with its `text` centered inside, offset 5px down to visually center it
   * against the circle's midline. When `dim` is set, the whole draw runs at half `globalAlpha`
   * (restored to `1.0` afterward) - used by `BubbleCloud` to fade out bubbles that lost focus. The
   * `_now` timestamp is accepted for interface parity with `MortalBubble.draw()`/`KineticObject.draw()`
   * but is never read - a `Bubble` never expires on its own. */
  draw(context: CanvasRenderingContext2D, _now: number): void {
    if (this.dim) context.globalAlpha = 0.5

    context.shadowColor = this.shadowColor
    context.shadowBlur = 10
    context.shadowOffsetX = 0
    context.shadowOffsetY = 10

    const util = new canvasBaseUtil.CanvasBase(context)
    util.drawCircle(this.pos[0], this.pos[1], this.radius, this.color)
    context.fillStyle = this.textColor
    context.textAlign = 'center'
    context.font = this.textStyle
    context.fillText(this.text, this.pos[0], this.pos[1] + 5)
    context.globalAlpha = 1.0
  }
}
