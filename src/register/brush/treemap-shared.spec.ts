import { describe, expect, it } from 'vitest'
import { NodeManager } from './treemap-shared'

describe('NodeManager.updateNode()', () => {
  it('updates a flat field on the node without throwing', () => {
    const manager = new NodeManager()
    manager.appendNode({ text: 'A', value: 10 })

    const updated = manager.updateNode('0', { value: 42 })

    expect(updated.value).toBe(42)
    expect(manager.getNode('0')).toMatchObject({ value: 42 })
  })

  it('updates multiple flat fields at once', () => {
    const manager = new NodeManager()
    manager.appendNode({ text: 'A', value: 10, x: 1, y: 2, width: 3, height: 4 })

    const updated = manager.updateNode('0', { text: 'B', value: 99, width: 30 })

    expect(updated.text).toBe('B')
    expect(updated.value).toBe(99)
    expect(updated.width).toBe(30)
    // untouched fields are left alone
    expect(updated.x).toBe(1)
    expect(updated.y).toBe(2)
    expect(updated.height).toBe(4)
  })
})
