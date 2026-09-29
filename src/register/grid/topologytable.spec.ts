import { describe, expect, it, vi } from 'vitest'
import { TopologyTableGrid } from './topologytable'

function makeAxis(overrides: Partial<{ data: unknown[]; area: { x: number; y: number; width: number; height: number } }> = {}) {
  const area = overrides.area ?? { x: 0, y: 0, width: 400, height: 300 }
  const data = overrides.data ?? []

  return {
    data,
    area: () => area,
    getValue: (row: Record<string, unknown>, field: string) => row[field],
  }
}

function makeGrid(overrides: Record<string, unknown> = {}) {
  return { sort: 'linear', space: 50, hide: false, ...overrides }
}

describe('TopologyTableGrid', () => {
  describe('drawBefore/scale - linear sort', () => {
    it('populates axis.cacheXY with one entry per data row, all within the axis area bounds', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] }) as any
      g.grid = makeGrid() as any

      g.drawBefore!()

      const axis = g.axis as unknown as { cacheXY: { x: number; y: number }[] }
      expect(axis.cacheXY.length).toBe(3)
      for (const p of axis.cacheXY) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
      }
    })

    it('initializes axis.cache to {scale:1, viewX:0, viewY:0, nodeKey:null} exactly once', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }] }) as any
      g.grid = makeGrid() as any

      g.drawBefore!()

      const axis = g.axis as unknown as { cache: { scale: number; viewX: number; viewY: number; nodeKey: string | null } }
      expect(axis.cache).toEqual({ scale: 1, viewX: 0, viewY: 0, nodeKey: null })

      // A second drawBefore() call (e.g. a redraw) must NOT reset an already-mutated cache - same
      // "only initialize if not already set" guard the real legacy engine uses.
      axis.cache.viewX = 42
      g.drawBefore!()
      expect(axis.cache.viewX).toBe(42)
    })
  })

  describe('drawBefore/scale - random sort', () => {
    it('populates axis.cacheXY with one entry per data row, all within the axis area bounds', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }, { key: 'b' }] }) as any
      g.grid = makeGrid({ sort: 'random' }) as any

      g.drawBefore!()

      const axis = g.axis as unknown as { cacheXY: { x: number; y: number }[] }
      expect(axis.cacheXY.length).toBe(2)
      for (const p of axis.cacheXY) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThan(400)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThan(300)
      }
    })
  })

  describe('drawBefore/scale - unrecognized sort value', () => {
    // Regression test: an unrecognized `grid.sort` (a typo, or any config from an untyped/JSON/API
    // source bypassing the `'linear' | 'random'` TS union) used to leave `axis.cacheXY` completely
    // unassigned, since `SORT_STRATEGIES[grid.sort]` resolves to `undefined` and there was no
    // fallback branch. `scale()`'s returned closure unconditionally dereferences
    // `axisRef.cacheXY![resolvedIndex]` on the very first render of any `topologynode` chart, so
    // this crashed immediately, not just on some later interaction.
    it('falls back to the linear sort strategy instead of leaving axis.cacheXY unset', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] }) as any
      g.grid = makeGrid({ sort: 'not-a-real-strategy' }) as any

      expect(() => g.drawBefore!()).not.toThrow()

      const axis = g.axis as unknown as { cacheXY: { x: number; y: number }[] }
      expect(axis.cacheXY).toBeDefined()
      expect(axis.cacheXY.length).toBe(3)
      for (const p of axis.cacheXY) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    })

    it('does not throw when scale(index) is used after an unrecognized sort value (first-render path)', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }, { key: 'b' }] }) as any
      g.grid = makeGrid({ sort: 'not-a-real-strategy' }) as any

      g.drawBefore!()

      expect(() => g.scale(0)).not.toThrow()
      const result = g.scale(0)
      expect(Number.isFinite(result.x)).toBe(true)
      expect(Number.isFinite(result.y)).toBe(true)
    })
  })

  describe('scale(index)', () => {
    it('returns {x, y, scale} plus mutator closures for a numeric index, scaled by axis.cache.scale', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }, { key: 'b' }] }) as any
      g.grid = makeGrid() as any

      g.drawBefore!()
      const axis = g.axis as unknown as { cacheXY: { x: number; y: number }[]; cache: { scale: number; viewX: number; viewY: number } }
      axis.cacheXY[0] = { x: 10, y: 20 }
      axis.cache.scale = 2

      const result = g.scale(0)
      expect(result.x).toBe((10 + axis.cache.viewX) * 2)
      expect(result.y).toBe((20 + axis.cache.viewY) * 2)
      expect(result.scale).toBe(2)
      expect(typeof result.setX).toBe('function')
      expect(typeof result.setY).toBe('function')
      expect(typeof result.setScale).toBe('function')
      expect(typeof result.setView).toBe('function')
      expect(typeof result.moveLast).toBe('function')
    })

    it('resolves a string key via axis.getValue-based lookup, same as a numeric index', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }, { key: 'b' }] }) as any
      g.grid = makeGrid() as any

      g.drawBefore!()
      const axis = g.axis as unknown as { cacheXY: { x: number; y: number }[] }
      axis.cacheXY[1] = { x: 5, y: 6 }

      const byKey = g.scale('b')
      const byIndex = g.scale(1)
      expect(byKey.x).toBe(byIndex.x)
      expect(byKey.y).toBe(byIndex.y)
    })

    it('returns only the mutator closures (no x/y/scale) when the key does not resolve to any row', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis({ data: [{ key: 'a' }] }) as any
      g.grid = makeGrid() as any

      g.drawBefore!()

      const result = g.scale('does-not-exist')
      expect(result.x).toBeUndefined()
      expect(result.y).toBeUndefined()
      expect(result.scale).toBeUndefined()
      expect(typeof result.setX).toBe('function')
    })

    it('setX/setY/setScale/setView/moveLast mutate the underlying axis.cacheXY/axis.cache/axis.data', () => {
      const g = new TopologyTableGrid()
      const data = [{ key: 'a' }, { key: 'b' }]
      g.axis = makeAxis({ data }) as any
      g.grid = makeGrid() as any

      g.drawBefore!()
      const axis = g.axis as unknown as { cacheXY: { x: number; y: number }[]; cache: { scale: number; viewX: number; viewY: number } }

      const result = g.scale(0)
      result.setX(100)
      expect(axis.cacheXY[0].x).toBe(100 - axis.cache.viewX)

      result.setY(200)
      expect(axis.cacheXY[0].y).toBe(200 - axis.cache.viewY)

      result.setScale(3)
      expect(axis.cache.scale).toBe(3)

      result.setView(7, 8)
      expect(axis.cache.viewX).toBe(7)
      expect(axis.cache.viewY).toBe(8)

      const beforeMove = axis.cacheXY.slice()
      const beforeData = (axis as unknown as { data: unknown[] }).data.slice()
      result.moveLast()
      // The moved-to-front entry now sits at the END of both arrays.
      expect(axis.cacheXY[axis.cacheXY.length - 1]).toEqual(beforeMove[0])
      expect((axis as unknown as { data: unknown[] }).data[(axis as unknown as { data: unknown[] }).data.length - 1]).toEqual(beforeData[0])
    })
  })

  describe('draw', () => {
    it('forces grid.hide = true and delegates to drawGrid()', () => {
      const g = new TopologyTableGrid()
      g.axis = makeAxis() as any
      g.grid = makeGrid({ hide: false }) as any

      const drawGridSpy = vi.spyOn(g, 'drawGrid').mockReturnValue({ root: {} as any, scale: undefined })
      g.draw!()

      expect((g.grid as unknown as { hide: boolean }).hide).toBe(true)
      expect(drawGridSpy).toHaveBeenCalledWith()
    })
  })
})
