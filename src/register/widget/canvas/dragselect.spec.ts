import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'
import { installStubCanvasContext } from '../../brush/canvas/testCanvasStub'

let patch: { restore: () => void } | null = null

afterEach(() => {
  patch?.restore()
  patch = null
})

describe('canvas.dragselect widget', () => {
  it('mounts without drawing anything until a drag actually happens (mirrors the plain "dragselect" widget\'s initially-0x0 rect)', () => {
    patch = installStubCanvasContext()

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
        brush: [{ type: 'canvas.scatter', target: ['v'] }],
        widget: [{ type: 'canvas.dragselect', brush: [0] }],
      },
    })

    // No rubber band exists until a real drag happens - unlike the SVG version (which always
    // renders a zero-sized <rect>), a canvas widget has nothing to point at before its first
    // fillRect/strokeRect call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder = (wrapper.vm as any).getBuilder()
    const sub = builder._canvas.sub as { calls: string[] }
    expect(sub.calls).not.toContain('fillRect')
    expect(sub.calls).not.toContain('strokeRect')
  })

  it('still mounts for an out-of-range brush index - same Builder.get("brush", key) fallback-to-whole-array quirk "dragselect.ts" documents, not a crash', () => {
    patch = installStubCanvasContext()

    // A proper x/y-typed axis (unlike dragselect.spec.ts's own version of this test, which gets
    // away with a bare `{ data: [...] }` axis only because "pyramid" tolerates it) - canvas.scatter
    // itself calls `this.axis.x(dataIndex)` as a real scale function at draw time, so it needs one.
    expect(() =>
      mount(Chart, {
        props: {
          width: 400,
          height: 300,
          canvas: true,
          axis: [{ x: { type: 'range', domain: [0, 10] }, y: { type: 'range', domain: [0, 10] }, data: [{ v: 1 }] }],
          brush: [{ type: 'canvas.scatter', target: ['v'] }],
          widget: [{ type: 'canvas.dragselect', brush: [5] }],
        },
      }),
    ).not.toThrow()
  })
})

// No test exercises a real mousedown/mousemove/mouseup drag sequence end-to-end: `Builder.
// drawWidget()` constructs a fresh widget instance per render pass and never retains it anywhere
// externally reachable (confirmed by reading that method - the local `draw` variable it builds is
// never stored back onto `this._widget[i]` or any other persistent field), so there's no handle to
// call this widget's own private onDrawStart/onDrawEnd from outside after mount. This mirrors
// dragselect.spec.ts's own established scope (mount-time shape only, no simulated drag there
// either) - real drag/pointer sequences are verified against the live site via Playwright instead.
