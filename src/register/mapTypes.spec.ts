// Integration coverage for `mapTypes.ts` + `Chart.vue`'s own `Object.assign(b, { mapType: MAP_TYPE })`
// wiring - the Part 2 counterpart to `gridTypes.spec.ts`'s own coverage of `GRID_TYPES`. Doesn't
// fetch a real map SVG asset (out of scope - see `./brush/map/testMapXhrStub.ts`'s own header
// comment for why jsdom can't do real synchronous XHR anyway); stubs the network-dependent
// `loadPath()` path the same way every other `map.*` brush/widget spec in this project already
// does.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../Chart.vue'
import { MAP_TYPE } from './mapTypes'
import { installStubMapXhr } from './brush/map/testMapXhrStub'

interface ExposedBuilder {
  mapType?: unknown
  axis(index: number): unknown
}

describe('mapTypes / Chart.vue mapType wiring', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installStubMapXhr()
  })
  afterEach(() => {
    uninstall()
  })

  it('stamps MAP_TYPE (jui-graph-ts\'s now-render()-capable Map) onto the underlying Builder as mapType', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): ExposedBuilder }).getBuilder()
    expect(builder.mapType).toBe(MAP_TYPE)
  })

  it('mounts without throwing against an axis.map config, and the map axis actually resolves to a ' +
    "real, rendered scale (not the raw config, and not left null) - confirming the wiring actually " +
    'reaches jui-graph-ts\'s Map engine end to end, not just that mapType is set', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
      },
    })

    expect(wrapper.element.querySelector('svg')).not.toBeNull()

    const builder = (wrapper.vm as unknown as { getBuilder(): ExposedBuilder }).getBuilder()
    const axis = builder.axis(0) as { map?: unknown }

    // After a successful reload(), `axis.map` is `drawMapType()`'s returned scale - a callable
    // `MapScale` function (see jui-graph-ts's `base/map.ts`), stamped with a `.root` (the rendered
    // map group's `TransElement`) by `drawMapType()` itself. Neither of those exists unless the
    // real `Map` instance's `render()` (this project's Tier-A fix) actually ran to completion.
    expect(typeof axis.map).toBe('function')
    expect((axis.map as { root?: unknown }).root).toBeTruthy()
  })
})
