// jsdom has no real synchronous-XHR/network support (confirmed empirically: any `map.*`
// brush/widget that reaches `jui-graph-ts`'s `base/map.ts` `Map.loadPath()` - which does a
// genuinely synchronous `xhr.open(..., false); xhr.send("")` against the configured `map.path` -
// throws a raw jsdom `NetworkError: Network error` synchronously, propagating all the way up
// through `Chart.vue`'s `mount()`). This ONLY became reachable once `chartMap.ts`'s `ChartBuilder`
// started setting a truthy `mapType` placeholder (needed to work around a real, separate
// `jui-graph-ts` bug - see that file's header comment) - before that fix, `drawMapType()` returned
// `null` before ever touching `this.map`, so no XHR was ever attempted at all and these specs
// passed by accident, not because anything real was exercised.
//
// This stub swaps in a minimal fake `XMLHttpRequest` (same "stub the platform API jsdom lacks"
// idiom as this package's own `register/brush/canvas/testCanvasStub.ts`) that synchronously
// "succeeds" with an empty-but-valid SVG document (`<svg xmlns="...svg"></svg>`, zero `<g>`/
// `<path>`/`<polygon>` children) - `Map.loadPath()`'s own `svgTags.length !== 1` check passes (the
// root `<svg>` itself IS the one match `getElementsByTagName("svg")` finds), so `Map` resolves the
// path/polygon list to `[]` and moves on cleanly, same as a real (but geo-data-empty) map SVG
// would. No fake geo data is invented - these specs only assert "mounts without throwing"/`setup()`
// defaults, real per-path/per-bubble rendering against real geo SVGs is Playwright-verified against
// the live site instead (see each spec file's own test name for that division of responsibility).
/** Test-only helper (used by `map/*.spec.ts` files, not part of the public library surface):
 * monkey-patches the global `XMLHttpRequest` with a stub that serves a canned response for map-data
 * requests, returning a `restore()` callback. See this file's own header comment. */
export function installStubMapXhr(): () => void {
  const g = globalThis as unknown as { XMLHttpRequest: unknown }
  const original = g.XMLHttpRequest

  class StubXMLHttpRequest {
    readyState = 0
    status = 0
    responseXML: Document | null = null

    open(_method: string, _url: string, _async?: boolean): void {
      this.readyState = 1
    }

    send(_body?: unknown): void {
      this.responseXML = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/svg+xml')
      this.readyState = 4
      this.status = 200
    }
  }

  g.XMLHttpRequest = StubXMLHttpRequest as unknown

  return () => {
    g.XMLHttpRequest = original
  }
}
