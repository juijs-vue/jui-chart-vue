// Port of legacy `src/brush/map/note.js` ("chart.brush.map.note", extend: "chart.brush.map.core")
// - a persistent (non-hover) tooltip-style "note" balloon per data row, shown/hidden by id via
// `brush.active`/`brush.activeEvent`.
import { registerBrush, MapCoreBrush } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type MapScaleFn = (id: string) => { x: number; y: number } | undefined

const PADDING = 7
const ANCHOR = 7
const TEXT_Y = 14

/** `chart.brush.map.note`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface MapNoteBrushOptions {
  /** Row `id`s whose note balloon starts visible; every other row's balloon starts hidden. */
  active?: unknown[]
  /** DOM event name that, when it fires on a row, shows that row's balloon and hides every other
   * one. No such toggling wired up when omitted. */
  activeEvent?: string | null
  /** Formats a row's balloon text; defaults to `"<id>: <value>"` when omitted. */
  format?: ((...args: unknown[]) => unknown) | null
}

/** Own `chart.brush.map.note.setup()` fields - see legacy `map/note.js`. */
export const MAP_NOTE_BRUSH_OWN_DEFAULTS: MapNoteBrushOptions = {
  active: [],
  activeEvent: null,
  format: null,
}

export class MapNoteBrush extends MapCoreBrush {
  private g: any
  private tooltips: Record<string, any> = {}

  /** Creates the render group that will hold every row's note balloon. */
  drawBefore = (): void => {
    this.g = this.chart.svg.group()
  }

  /** When `activeEvent` is set, wires a listener that, on that event firing for a row, shows only
   * that row's cached balloon (from `tooltips`, keyed by `id`) and hides every other tracked one -
   * PRESERVED BUG (also present in the legacy source): the "show" branch sets
   * `visibility: 'visibility'`, not the valid CSS value `'visible'`, so this toggle-to-visible path
   * never actually un-hides a balloon in a real browser; only a balloon whose `id` was in the
   * initial `active` list (set the same way below) stays visible from the start. Then draws every
   * row's balloon (skipped when its `id` doesn't resolve to a map position): sized to fit its text
   * (`format(row)` when set, else `"<id>: <value>"`) plus any extra `texts` lines stacked above the
   * main line, anchored above the row's map position, and cached into `tooltips` by `id` for the
   * `activeEvent` handler to find later. */
  draw = (): any => {
    const brush = this.brush as Record<string, unknown>

    if (brush.activeEvent != null) {
      this.on(brush.activeEvent as string, (obj: { data: BrushData }) => {
        const targetId = this.axis.getValue(obj.data, 'id') as string

        if (this.tooltips[targetId]) {
          for (const id in this.tooltips) {
            this.tooltips[id].attr({ visibility: targetId == id ? 'visibility' : 'hidden' })
          }
        }
      })
    }

    this.eachData((d) => {
      const row = d as BrushData
      const id = this.axis.getValue(row, 'id') as string
      const value = this.axis.getValue(row, 'value', 0)
      const texts = (this.axis.getValue(row, 'texts', []) as unknown[]) ?? []
      let text: unknown = `${id}: ${value}`
      const xy = ((this.axis as unknown as Record<string, unknown>).map as unknown as MapScaleFn)(id)

      if (typeof brush.format === 'function') {
        text = this.format(row)
      }

      const size = (this.chart.svg as unknown as { getTextSize(t: string): { width: number; height: number } }).getTextSize(String(text))
      const w = size.width + PADDING * 2
      const h = size.height

      if (xy != null) {
        const tooltip = this.chart.svg
          .group(
            {
              visibility: (brush.active as unknown[]).includes(id) ? 'visibility' : 'hidden',
            },
            () => {
              this.chart.svg.polygon({
                points: this.balloonPoints('top', w, h, ANCHOR),
                fill: this.chart.theme('tooltipBackgroundColor'),
                'fill-opacity': this.chart.theme('tooltipBackgroundOpacity'),
                stroke: this.chart.theme('tooltipBorderColor'),
                'stroke-width': 1,
              })

              this.chart.text(
                {
                  'font-size': this.chart.theme('tooltipFontSize'),
                  fill: this.chart.theme('tooltipFontColor'),
                  'text-anchor': 'middle',
                  x: w / 2,
                  y: TEXT_Y,
                },
                String(text),
              )
              ;(this.chart as unknown as { texts(attr: Record<string, unknown>, list: unknown[], rate?: number): any })
                .texts(
                  {
                    'font-size': this.chart.theme('tooltipFontSize'),
                    fill: this.chart.theme('tooltipFontColor'),
                    'text-anchor': 'start',
                  },
                  texts,
                  1.2,
                )
                .translate(0, -(TEXT_Y * texts.length))
            },
          )
          .translate(xy.x - w / 2, xy.y - h - ANCHOR)

        this.tooltips[id] = tooltip
        this.g.append(tooltip)
      }
    })

    return this.g
  }

  /** Returns this brush's own default options (`active`/`activeEvent`/`format`), merged by
   * `defineOptions()` on top of `MapCoreBrush.setup()`'s inherited defaults. */
  static setup(): Record<string, unknown> {
    return MAP_NOTE_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('map.note', MapNoteBrush)
