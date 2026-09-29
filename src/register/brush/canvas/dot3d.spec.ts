import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Builder } from 'jui-graph-ts'
import Chart from '../../../Chart.vue'
import { installStubCanvasContext } from './testCanvasStub'

let patch: { restore: () => void } | null = null

afterEach(() => {
  patch?.restore()
  patch = null
})

function mount3d(brush: Record<string, unknown>, data: unknown[]) {
  return mount(Chart, {
    props: {
      width: 400,
      height: 300,
      canvas: true,
      axis: [
        {
          x: { type: 'range', domain: [0, 10] },
          y: { type: 'range', domain: [0, 10] },
          z: { type: 'range', domain: [0, 10] },
          depth: 100,
          degree: { x: 10, y: 20, z: 0 },
          perspective: 0.8,
          data,
        },
      ],
      brush: [brush],
    },
  })
}

describe('canvas.dot3d brush', () => {
  it('symbol: "dot" (the default) draws one circle per [x,y,z] row', () => {
    patch = installStubCanvasContext()

    const wrapper = mount3d({ type: 'canvas.dot3d', size: 6 }, [
      [1, 2, 3],
      [4, 5, 6],
    ])

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('arc')
    expect(buffer.calls).toContain('fill')
  })

  it('2D rows ([x,y], length 2) get a z=0 padded in place before drawing (mutates the row)', () => {
    patch = installStubCanvasContext()

    const rows: number[][] = [[1, 2]]
    mount3d({ type: 'canvas.dot3d' }, rows)

    expect(rows[0]).toEqual([1, 2, 0])
  })

  it('symbol: "line" draws connecting strokes between consecutive rows', () => {
    patch = installStubCanvasContext()

    const wrapper = mount3d({ type: 'canvas.dot3d', symbol: 'line' }, [
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
    ])

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls).toContain('stroke')
  })

  it('symbol: "poly" with exactly 3 points closes and fills once, at the true last row (sanity check - unaffected by the datas.length fix)', () => {
    patch = installStubCanvasContext()

    const wrapper = mount3d({ type: 'canvas.dot3d', symbol: 'poly' }, [
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
    ])

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls.filter((c) => c === 'fill').length).toBe(1)
    expect(buffer.calls.filter((c) => c === 'closePath').length).toBe(1)
  })

  it('symbol: "poly" with FEWER than 3 points still closes and fills the shape (was: never closed at all - ' +
    "isLast read the current row's own (always-3, post z-padding) length instead of datas.length)", () => {
    patch = installStubCanvasContext()

    const wrapper = mount3d({ type: 'canvas.dot3d', symbol: 'poly' }, [
      [1, 1, 1],
      [2, 2, 2],
    ])

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    expect(buffer.calls.filter((c) => c === 'fill').length).toBe(1)
    expect(buffer.calls.filter((c) => c === 'closePath').length).toBe(1)
  })

  it('symbol: "poly" with MORE than 3 points closes and fills at the true last row, not prematurely mid-dataset ' +
    '(was: closed/filled at row index 2, then kept drawing unclosed segments afterward)', () => {
    patch = installStubCanvasContext()

    const wrapper = mount3d({ type: 'canvas.dot3d', symbol: 'poly' }, [
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
      [4, 4, 4],
      [5, 5, 5],
    ])

    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const buffer = (builder as unknown as { _canvas: { buffer: { calls: string[] } } })._canvas.buffer

    // Only ever closes/fills once, no matter the dataset size.
    expect(buffer.calls.filter((c) => c === 'fill').length).toBe(1)
    expect(buffer.calls.filter((c) => c === 'closePath').length).toBe(1)

    // And it must happen at the true end - no more line segments (`stroke`) drawn after the fill.
    const lastFillIndex = buffer.calls.lastIndexOf('fill')
    const lastStrokeIndex = buffer.calls.lastIndexOf('stroke')
    expect(lastFillIndex).toBeGreaterThan(lastStrokeIndex)
  })

  it('setup() defaults size/color/symbol', () => {
    patch = installStubCanvasContext()

    const wrapper = mount3d({ type: 'canvas.dot3d' }, [[1, 1, 1]])
    const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder()
    const brush = (builder as unknown as { get(type: string, key: number): Record<string, unknown> }).get('brush', 0)

    expect(brush.size).toBe(4)
    expect(brush.color).toBe(0)
    expect(brush.symbol).toBe('dot')
  })
})
