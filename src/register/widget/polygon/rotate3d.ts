// Port of legacy `src/widget/polygon/rotate3d.js` ("chart.widget.polygon.rotate3d", extend:
// "chart.widget.polygon.core") - a drag-to-rotate interaction widget for 3D (`polygon.*`-brush)
// charts: on `mousedown` over an axis, tracks the drag delta and maps it to `axis.degree.x`/
// `axis.degree.y` (clamped to a `unit`-degree grid), re-rendering the whole chart on every step
// that actually changes the snapped angle.
//
// `PolygonRotate3DWidget extends PolygonCoreWidget` (`jui-graph-ts`'s real port of
// `chart.widget.polygon.core` - a two-line pass-through over `CoreWidget` with an empty
// `drawAfter()` override, see that file's own header comment) - confirmed from the legacy file's
// own `extend` field.
import { PolygonCoreWidget, registerWidget } from 'jui-graph-ts'

const DEGREE_LIMIT = 180

interface RotatableAxis {
  area(key: string): number
  degree: { x: number; y: number; z: number }
  set(key: string, value: unknown): void
}

interface AxisMouseEvent {
  chartX: number
  chartY: number
}

/** `chart.widget.polygon.rotate3d`'s own config fields (on top of `WidgetConfig`'s `render`/`type`/`index`). */
export interface PolygonRotate3DWidgetOptions {
  /** Degree-snap grid for the drag-to-rotate gesture - a render only happens when the drag delta
   * crosses a multiple of this many degrees on both axes. */
  unit?: number
  /** Which axis (or axes) to wire the rotate-drag gesture onto - a single index or an array. */
  axis?: number | number[]
}

/** Own `chart.widget.polygon.rotate3d.setup()` fields - see legacy `polygon/rotate3d.js`. */
export const POLYGON_ROTATE3D_WIDGET_OWN_DEFAULTS: PolygonRotate3DWidgetOptions = {
  unit: 5,
  axis: [0],
}

/** `chart.widget.polygon.rotate3d` - a drag-to-rotate interaction widget for 3D (`polygon.*`-brush)
 * charts: on `mousedown` over a configured axis, tracks the drag delta and maps it to
 * `axis.degree.x`/`axis.degree.y` (clamped to a `widget.unit`-degree snap grid), re-rendering the
 * whole chart on every step that actually changes the snapped angle. */
export class PolygonRotate3DWidget extends PolygonCoreWidget {
  /** Wires the drag-to-rotate gesture for one axis (scoped via `axisIndex`, despite its own
   * "scroll" name - a literal port of the legacy method name, which really drives a rotation, not a
   * scroll). `mousedown` captures the drag start position and the axis's own starting
   * `degree.x`/`degree.y`; `mousemove` maps the drag delta (as a fraction of the axis area's own
   * `width`/`height`) onto a `±DEGREE_LIMIT` (180°) degree change, floors it to a multiple of
   * `widget.unit`, and only actually writes `axis.set('degree', ...)` + re-renders when that snapped
   * `dx`/`dy` pair differs from the last one applied (`cacheXY`) - both AND'd together via `dx % unit
   * != 0 && dy % unit != 0`, i.e. a render is skipped only when NEITHER axis has crossed a fresh
   * `unit`-degree boundary (crossing on just one axis still renders). `mouseup`/`bg.mouseup`/
   * `chart.mouseup` end the drag. */
  private setScrollEvent(axisIndex: number): void {
    const axis = this.chart.axis(axisIndex) as RotatableAxis
    const widget = this.widget as Record<string, unknown>
    const unit = widget.unit as number
    const w = axis.area('width')
    const h = axis.area('height')

    let isMove = false
    let mouseStartX = 0
    let mouseStartY = 0
    let sdx = 0
    let sdy = 0
    let cacheXY: string | null = null

    const mousedown = (e: AxisMouseEvent): void => {
      if (isMove) return

      isMove = true
      mouseStartX = e.chartX
      mouseStartY = e.chartY
      sdx = axis.degree.x
      sdy = axis.degree.y
    }

    const mousemove = (e: AxisMouseEvent): void => {
      if (!isMove) return

      const gapX = e.chartX - mouseStartX
      const gapY = e.chartY - mouseStartY
      const dx = sdx + Math.floor((gapY / h) * DEGREE_LIMIT)
      const dy = sdy - Math.floor((gapX / w) * DEGREE_LIMIT)

      // 각도 Interval이 맞을 경우, 렌더링하지 않음 (skip re-render unless the snapped angle
      // actually changed on this drag step).
      if (dx % unit != 0 && dy % unit != 0) return

      // 이전 각도와 동일할 경우, 렌더링하지 않음 (skip re-render if identical to the last
      // rendered angle).
      const newCacheXY = dx + ':' + dy
      if (cacheXY == newCacheXY) return

      axis.set('degree', { x: dx, y: dy })

      this.chart.render()
      cacheXY = newCacheXY
    }

    const mouseup = (): void => {
      if (!isMove) return

      isMove = false
      mouseStartX = 0
      mouseStartY = 0
    }

    this.on('axis.mousedown', mousedown, axisIndex)
    this.on('axis.mousemove', mousemove, axisIndex)
    this.on('axis.mouseup', mouseup, axisIndex)
    this.on('bg.mouseup', mouseup)
    this.on('chart.mouseup', mouseup)
  }

  /** Wires `setScrollEvent()` for every axis index in `widget.axis`. Returns `void`, not a group -
   * this widget only attaches interaction handlers, drawing nothing visible of its own. */
  draw = (): void => {
    const widget = this.widget as Record<string, unknown>
    const indexes = Array.isArray(widget.axis) ? (widget.axis as number[]) : [widget.axis as number]

    for (let i = 0; i < indexes.length; i++) {
      this.setScrollEvent(indexes[i])
    }
  }

  /** Supplies `POLYGON_ROTATE3D_WIDGET_OWN_DEFAULTS` to the widget registry's default-merge step. */
  static setup(): Record<string, unknown> {
    return POLYGON_ROTATE3D_WIDGET_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerWidget('polygon.rotate3d', PolygonRotate3DWidget)
