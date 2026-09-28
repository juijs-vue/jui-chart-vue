// Port of legacy `src/brush/heatmapscatter.js` ("chart.brush.heatmapscatter", extend:
// "chart.brush.core") - extends `CoreBrush` directly, genuinely unrelated to `heatmap.js` despite
// the shared file-naming pattern (each has its own independent `extend` chain and its own,
// unrelated color/geometry model - cross-checked against `main` branch's `useHeatmapScatter.ts`
// header comment, which independently confirmed the same finding). A coarse 2D density grid over
// ordinary scatter points (NOT a scatter chart with heatmap-style per-point coloring): buckets
// every `(row, target)` point into a fixed-size table (`xInterval`/`yInterval` wide/tall cells,
// re-using the LAST color written to a cell as the whole cell's fill) and renders one `<rect>` per
// cell that received at least one point.
//
// **Real date axis, ported literally - unlike `main` branch's necessary workaround**: the real
// legacy usage (`examples/heatmapscatter.html`) uses a `type: "date"` x-axis with `axis.x(i)`
// (row-index positioning) ALSO expected to support `axis.x.min()`/`.max()`/`.invert()` (real
// domain-value operations) on the SAME scale object. `main` branch's from-scratch Vue port had no
// real date axis at all and had to hand-roll an adapted tick-index bucketing scheme instead (see
// its own `useHeatmapScatter.ts` header comment). This project's `jui-graph-ts`-backed `<Chart>`
// has a REAL date axis (`DateGrid`) whose own `wrapper()` (confirmed by reading `grid/date.ts` in
// full) provides exactly this dual index/value behavior WHEN the axis config sets `key` (e.g.
// `key: "date"`) - so this brush is ported here as a direct, literal translation against a real
// `type: "date"` x-axis, no adaptation needed.
import { CoreBrush, registerBrush } from 'jui-graph-ts'
import type { BrushAxisScale, BrushData } from 'jui-graph-ts'

/** `chart.brush.heatmapscatter`'s own config fields (on top of `jui-graph-ts`'s `BrushOptions`). */
export interface HeatmapScatterBrushOptions {
  /** Width in px of each density-grid bucket cell along the x-axis. */
  xInterval?: number
  /** Height in px of each density-grid bucket cell along the y-axis. */
  yInterval?: number
  /** If the brush is drawn outside of the chart, cut the area - redeclared here because
   * `heatmapscatter.js` defaults this to `false`, unlike `BrushOptions`'s own `true` default. */
  clip?: boolean
}

/** Own `chart.brush.heatmapscatter.setup()` fields - see legacy `heatmapscatter.js`. */
export const HEATMAP_SCATTER_BRUSH_OWN_DEFAULTS: HeatmapScatterBrushOptions = {
  xInterval: 0,
  yInterval: 0,
  clip: false,
}

interface HeatmapCell {
  data: unknown[]
  element: any
  draw: boolean
  color: unknown
  x: number
  y: number
  xValue: unknown
  yValue: unknown
}

export class HeatmapScatterBrush extends CoreBrush {
  private g: any
  // Named `cellMap`, not the legacy closure var's own name `map` - `Draw` (this class's real base)
  // already declares a PUBLIC `map: any` field of its own (for the sibling `chart.map`/map-axis
  // family), so a same-named PRIVATE field here would trip TS's visibility-narrowing-across-
  // inheritance rule (TS2415) - pure internal renaming, same precedent as every other Batch's
  // field-collision rename.
  private cellMap: HeatmapCell[][] = []

  private yValueSpan = 0
  private yDist = 0
  private ySize = 0
  private xValueSpan = 0
  private xDist = 0
  private xSize = 0

  /** Maps a real x/y domain value pair to its bucket cell in `cellMap`: divides the offset from each
   * axis's own `min()` by `xInterval`/`yInterval` and rounds to the nearest integer index, then
   * clamps into `[0, xDist)`/`[0, yDist)` so an out-of-range point (e.g. right at the axis's max)
   * still lands in the last valid cell instead of overflowing `cellMap`. */
  private getTableData(xValue: unknown, yValue: unknown): { map: HeatmapCell; rowIndex: number; columnIndex: number } {
    let xIndex = Number((((xValue as number) - (this.axis.x as BrushAxisScale & { min(): number }).min()) / ((this.brush as Record<string, unknown>).xInterval as number)).toFixed(0))
    let yIndex = Number((((yValue as number) - (this.axis.y as BrushAxisScale & { min(): number }).min()) / ((this.brush as Record<string, unknown>).yInterval as number)).toFixed(0))

    if (xIndex >= this.xDist) xIndex = this.xDist - 1
    if (yIndex >= this.yDist) yIndex = this.yDist - 1
    if (xIndex < 0) xIndex = 0
    if (yIndex < 0) yIndex = 0

    return {
      map: this.cellMap[yIndex][xIndex],
      rowIndex: yIndex,
      columnIndex: xIndex,
    }
  }

  /** Registers one scatter point into its density-grid cell (found via `getTableData()`, after
   * converting the pixel position `pos` back to domain values via `axis.x.invert()`/
   * `axis.y.invert()`): pushes the point's row onto the cell's `data` and overwrites the cell's
   * `color` with THIS point's color (so a multi-point cell ends up colored by whichever point was
   * bucketed into it LAST, not an aggregate). Creates the cell's `<rect>` the first time a point
   * lands in it (`element == null`); every SUBSEQUENT point into the same cell instead flips
   * `draw = true` so `drawScatter()` knows not to re-append/re-bind an event for an already-drawn
   * cell. Returns `null` (via the `try`/`catch`) if the resolved cell doesn't exist in `cellMap` -
   * a defensive guard against indices `getTableData()`'s own clamping didn't already prevent. */
  createScatter(pos: { x: number; y: number }, dataIndex: number, targetIndex: number): { data: unknown[]; element: any; draw: boolean; rowIndex: number; columnIndex: number } | null {
    let result: { data: unknown[]; element: any; draw: boolean; rowIndex: number; columnIndex: number } | null = null

    const tableInfo = this.getTableData((this.axis.x as BrushAxisScale & { invert(y: number): unknown }).invert(pos.x), (this.axis.y as BrushAxisScale & { invert(y: number): unknown }).invert(pos.y))
    const tableObj = tableInfo.map
    const color = this.color(dataIndex, targetIndex)

    try {
      tableObj.color = color
      tableObj.data.push(this.axis.data[dataIndex])

      if (tableObj.element == null) {
        tableObj.element = this.chart.svg.rect({
          width: this.xSize,
          height: this.ySize,
          x: tableObj.x,
          y: tableObj.y,
          fill: color,
          stroke: this.chart.theme('heatmapscatterBorderColor'),
          'stroke-width': this.chart.theme('heatmapscatterBorderWidth'),
        })
      } else {
        tableObj.draw = true
      }

      result = {
        data: tableObj.data,
        element: tableObj.element,
        draw: tableObj.draw,
        rowIndex: tableInfo.rowIndex,
        columnIndex: tableInfo.columnIndex,
      }
    } catch {
      result = null
    }

    return result
  }

  /** Buckets every `(row, target)` point (position from `axis.x(i)`/`axis.y(value)`, the ROW INDEX
   * for x per this brush's per-row-not-per-value x positioning) into its density-grid cell via
   * `createScatter()`, appending each cell's `<rect>` to `g` and binding its click/hover event
   * exactly once - only when `obj.draw == false`, i.e. the FIRST point that lands in a given cell -
   * since later points into the same cell just update its color/data without re-appending it. */
  drawScatter(g: any): void {
    const data = this.axis.data as BrushData[]
    const target = this.brush.target ?? []

    for (let i = 0; i < data.length; i++) {
      const xValue = (this.axis.x as BrushAxisScale)(i)

      for (let j = 0; j < target.length; j++) {
        const yValue = (this.axis.y as BrushAxisScale)(data[i][target[j]])

        const obj = this.createScatter({ x: xValue, y: yValue }, i, j)

        if (obj != null && obj.draw == false) {
          this.addEvent(obj.element, i, j)
          g.append(obj.element)
        }
      }
    }
  }

  /** Rebuilds the empty `cellMap` grid for this render pass (each cell pre-positioned at its own
   * `xPos`/`yPos - ySize`, so `createScatter()` only ever needs to fill in `element`/`color`/`data`
   * later - not compute geometry) and delegates to `drawScatter()` to bucket and draw every actual
   * point. Each cell's domain value is resolved via a real `Date` when the corresponding axis is
   * `type === 'date'`, per this file's header comment on real date-axis support. */
  draw = (): any => {
    this.g = this.chart.svg.group()

    const yMin = (this.axis.y as BrushAxisScale & { min(): number }).min()
    const xMin = (this.axis.x as BrushAxisScale & { min(): number }).min()

    for (let i = 0; i < this.yDist; i++) {
      if (!this.cellMap[i]) {
        this.cellMap[i] = []
      }

      const yVal = yMin + (this.yValueSpan / this.yDist) * i
      const yPos = (this.axis.y as BrushAxisScale)((this.axis.y as BrushAxisScale).type == 'date' ? new Date(yVal) : yVal)

      for (let j = 0; j < this.xDist; j++) {
        const xVal = xMin + (this.xValueSpan / this.xDist) * j
        const xPos = (this.axis.x as BrushAxisScale)((this.axis.x as BrushAxisScale).type == 'date' ? new Date(xVal) : xVal)

        this.cellMap[i][j] = {
          data: [],
          element: null,
          draw: false,
          color: null,
          x: xPos,
          y: yPos - this.ySize,
          xValue: xVal,
          yValue: yVal,
        }
      }
    }

    this.drawScatter(this.g)

    return this.g
  }

  /** Computes this render pass's density-grid dimensions from each axis's own domain span
   * (`max() - min()`) divided by the configured `xInterval`/`yInterval`: `xDist`/`yDist` (how many
   * buckets fit along each axis) and `xSize`/`ySize` (each bucket's pixel width/height, the plot
   * area divided by that bucket count). */
  drawBefore = (): void => {
    const brush = this.brush as Record<string, unknown>

    this.yValueSpan = (this.axis.y as BrushAxisScale & { max(): number; min(): number }).max() - (this.axis.y as BrushAxisScale & { min(): number }).min()
    this.yDist = this.yValueSpan / (brush.yInterval as number)
    this.ySize = this.axis.area('height') / this.yDist

    this.xValueSpan = (this.axis.x as BrushAxisScale & { max(): number; min(): number }).max() - (this.axis.x as BrushAxisScale & { min(): number }).min()
    this.xDist = this.xValueSpan / (brush.xInterval as number)
    this.xSize = this.axis.area('width') / this.xDist
  }

  /** Returns this brush's own default options (`xInterval`/`yInterval`/`clip`), merged by
   * `defineOptions()` on top of the inherited `CoreBrush`/`Draw` defaults. */
  static setup(): Record<string, unknown> {
    return HEATMAP_SCATTER_BRUSH_OWN_DEFAULTS as Record<string, unknown>
  }
}

registerBrush('heatmapscatter', HeatmapScatterBrush)
