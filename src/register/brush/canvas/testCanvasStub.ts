// Shared test-only helper for the `canvas.*` brush specs in this directory (and `dot3d.spec.ts`).
// jsdom (this project's unit-test environment, per `vitest.config.ts`'s `environment: 'jsdom'`)
// has no real `<canvas>` 2D context implementation - `HTMLCanvasElement.prototype.getContext('2d')`
// always returns `null` there (confirmed already documented by `register/widget/guideline.ts`'s own
// header comment: "Not implemented..." warnings are visible in every test run's console output).
// Since `jui-graph-ts`'s `Builder.initCanvasElement()` (`base/builder.ts`) wires `draw.canvas =
// this._canvas.buffer` straight from that `getContext('2d')` call, every `chart.brush.canvas.*`-
// family brush's `this.canvas` would be `null` in any test that mounts with `canvas: true` unless
// something stands in for a real 2D context.
//
// This monkey-patches `HTMLCanvasElement.prototype.getContext` (for the duration of one test, via
// `installStubCanvasContext()`'s returned `restore()`) to return a small recording stub instead - a
// plain object exposing every `CanvasRenderingContext2D` method any of this project's ported
// `canvas.*` brushes/`util/canvas/base.ts`'s `CanvasBase` call, each pushing its own name onto a
// shared `calls: string[]` array (so a test can assert e.g. `stub.calls.includes('beginPath')`)
// and returning a harmless default (`0`/`''`/a chainable no-op object, matching each real method's
// return shape closely enough that none of the ported brushes' own control flow - e.g.
// `context.getLineDash()` round-tripped through `setLineDash()` in `CanvasBase.drawDashedLine()` -
// breaks). `HidpiUtil.apply()` (`base/builder.ts`'s own post-`getContext()` call) is a documented
// no-op whenever `window.devicePixelRatio` is `1` (jsdom's own default) - true here, so this stub
// never needs to survive prototype-level DPR patching.
/** Test-only helper shape (used by `canvas/*.spec.ts` files, not part of the public library
 * surface): a recording stand-in for `CanvasRenderingContext2D`, since jsdom has no real 2D canvas
 * implementation - `calls` accumulates each invoked method's name so a test can assert e.g.
 * `stub.calls.includes('beginPath')`. See this file's own header comment. */
export interface StubCanvasContext {
  calls: string[]
  [key: string]: unknown
}

const METHOD_NAMES = [
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'arcTo',
  'rect',
  'fill',
  'stroke',
  'save',
  'restore',
  'clearRect',
  'fillRect',
  'strokeRect',
  'translate',
  'rotate',
  'scale',
  'fillText',
  'strokeText',
  'setLineDash',
  'drawImage',
]

/** Builds one recording stub `CanvasRenderingContext2D`-shaped object. Every method in
 * `METHOD_NAMES` records its own name into `calls`; a few methods that real `canvas.*` brush code
 * reads a return value FROM (`getLineDash`/`measureText`/`createLinearGradient`) get slightly
 * richer stand-ins instead of a bare recorder. */
export function createStubCanvasContext(): StubCanvasContext {
  const calls: string[] = []
  const stub: StubCanvasContext = { calls }

  for (const name of METHOD_NAMES) {
    stub[name] = (...args: unknown[]) => {
      calls.push(name)
      return args
    }
  }

  stub.getLineDash = () => {
    calls.push('getLineDash')
    return []
  }
  stub.measureText = (text: string) => {
    calls.push('measureText')
    return { width: String(text).length * 6 }
  }
  stub.createLinearGradient = () => {
    calls.push('createLinearGradient')
    return { addColorStop: () => {} }
  }
  stub.createRadialGradient = () => {
    calls.push('createRadialGradient')
    return { addColorStop: () => {} }
  }

  return stub
}

/** Monkey-patches `HTMLCanvasElement.prototype.getContext` for the current test - `type === '2d'`
 * returns a fresh `createStubCanvasContext()` per call (one canvas element gets one context, same
 * as the real DOM API), everything else falls back to the original (jsdom) implementation. Returns
 * a `restore()` to undo the patch - call it from `afterEach`. */
export function installStubCanvasContext(): { restore: () => void } {
  const original = HTMLCanvasElement.prototype.getContext

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    if (type === '2d') {
      return createStubCanvasContext()
    }
    return (original as unknown as (...a: unknown[]) => unknown).call(this, type, ...rest)
  }

  return {
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original
    },
  }
}
