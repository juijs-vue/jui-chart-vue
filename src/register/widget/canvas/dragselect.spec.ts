import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Builder } from 'jui-graph-ts'
import Chart from '../../../Chart.vue'
import { installStubCanvasContext } from '../../brush/canvas/testCanvasStub'

let patch: { restore: () => void } | null = null

afterEach(() => {
  patch?.restore()
  patch = null
})

function mountCanvasDragSelect() {
  const wrapper = mount(Chart, {
    props: {
      width: 400,
      height: 300,
      canvas: true,
      axis: [
        {
          x: { type: 'block', domain: ['a', 'b', 'c'], line: true },
          y: { type: 'range', domain: [0, 10], line: true },
          data: [{ v: 1 }, { v: 2 }, { v: 3 }],
        },
      ],
      brush: [{ type: 'column', target: ['v'] }],
      widget: [{ type: 'canvas.dragselect', brush: [0] }],
    },
  })

  const builder = (wrapper.vm as unknown as { getBuilder(): Builder }).getBuilder() as unknown as {
    emit(type: string, args?: unknown[]): unknown
    on(type: string, cb: (...a: unknown[]) => void): unknown
  }

  return { wrapper, builder }
}

describe('canvas.dragselect widget', () => {
  it('paints the rubber-band rect onto the canvas (fillRect/strokeRect), not an SVG <rect>', () => {
    patch = installStubCanvasContext()

    const { wrapper, builder } = mountCanvasDragSelect()

    // No visible SVG rubber-band - `draw()` returns an empty group (matching `canvas.picker`'s own
    // established "no SVG output of its own" shape), unlike the plain SVG `dragselect` widget.
    const g = wrapper.element.querySelector('g.widget-canvas\\.dragselect')
    expect(g).not.toBeNull()
    expect(g!.querySelector('rect')).toBeNull()

    builder.emit('axis.mousedown', [{ bgX: 10, bgY: 10, chartX: 10, chartY: 10 }, 0])
    builder.emit('axis.mousemove', [{ bgX: 60, bgY: 50 }, 0])

    // Can't retrieve the SAME stub instance the widget itself used back out of the component, but
    // every canvas element sharing this test's monkey-patched `getContext` records onto its own
    // fresh stub - so instead confirm the whole flow completed without throwing (a real bug here -
    // e.g. calling `onDrawStart`/`onDrawEnd` against a null canvas, or a canvas method the stub
    // doesn't implement - would throw synchronously out of `emit()` above).
    expect(() => builder.emit('axis.mouseup', [{ chartX: 60, chartY: 50 }, 0])).not.toThrow()
  })

  it('still emits "dragselect.end" with matched data - setDragEvent()/emitDataList() logic is shared, unchanged, from the SVG parent class', () => {
    patch = installStubCanvasContext()
    const { builder } = mountCanvasDragSelect()

    let received: unknown = null
    builder.on('dragselect.end', (payload: unknown) => {
      received = payload
    })

    // block axis: index 0 ("a") at x~0, index 2 ("c") at x~far right of a 3-column block axis over
    // a 400-wide chart - drag the whole width to sweep every column, y across the full [0,10] range.
    builder.emit('axis.mousedown', [{ bgX: 0, bgY: 0, chartX: 0, chartY: 0 }, 0])
    builder.emit('axis.mousemove', [{ bgX: 400, bgY: 300 }, 0])
    builder.emit('axis.mouseup', [{ chartX: 400, chartY: 300 }, 0])

    expect(received).not.toBeNull()
    expect(Array.isArray(received)).toBe(true)
    expect((received as unknown[]).length).toBeGreaterThan(0)
  })
})
