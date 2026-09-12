import { describe, expect, it } from 'vitest'
import { createMemoryStorage, generateDisplayName, getOrCreateInstallId } from './guest.ts'
import { displayNameFromInstallId } from './names.ts'

describe('guest identity', () => {
  it('creates an install id', () => {
    const id = getOrCreateInstallId(createMemoryStorage())
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('reuses the stored install id', () => {
    const storage = createMemoryStorage()
    const first = getOrCreateInstallId(storage)
    expect(getOrCreateInstallId(storage)).toBe(first)
  })

  it('keeps isolated storages independent', () => {
    const a = getOrCreateInstallId(createMemoryStorage())
    const b = getOrCreateInstallId(createMemoryStorage())
    expect(a).not.toBe(b)
  })

  it('reads a pre-seeded install id', () => {
    const storage = createMemoryStorage({ 'arrowflow.installId': 'seeded-id' })
    expect(getOrCreateInstallId(storage)).toBe('seeded-id')
  })

  it('generates a two-word name from the install id', () => {
    const storage = createMemoryStorage({ 'arrowflow.installId': '8f3c1a2e-4b5d-6789-abcd-ef0123456789' })
    expect(generateDisplayName(storage)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/)
  })

  it('persists the display name', () => {
    const storage = createMemoryStorage()
    const name = generateDisplayName(storage)
    expect(generateDisplayName(storage)).toBe(name)
  })

  it('reads a pre-seeded display name', () => {
    const storage = createMemoryStorage({ 'arrowflow.displayName': 'Quiet Needle 17' })
    expect(generateDisplayName(storage)).toBe('Quiet Needle 17')
  })

  it('does not leak names across storages', () => {
    const left = generateDisplayName(createMemoryStorage({ 'arrowflow.installId': 'aaaa' }))
    const right = generateDisplayName(
      createMemoryStorage({ 'arrowflow.displayName': 'Silver Thread 4821' }),
    )
    expect(right).toBe('Silver Thread 4821')
    expect(left).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/)
  })

  it('replaces a Threadabc-style stored name', () => {
    const id = '8f3c1a2e-4b5d-6789-abcd-ef0123456789'
    const storage = createMemoryStorage({
      'arrowflow.installId': id,
      'arrowflow.displayName': 'Threadabc',
    })
    expect(generateDisplayName(storage)).toBe(displayNameFromInstallId(id))
    expect(generateDisplayName(storage)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/)
  })
})
