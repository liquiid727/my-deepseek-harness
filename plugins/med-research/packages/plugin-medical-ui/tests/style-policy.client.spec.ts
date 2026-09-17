import { globSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const clientRoot = fileURLToPath(new URL('../src/client/', import.meta.url))

describe('medical UI style policy', () => {
  it('keeps color literals out of compiled styles', () => {
    const violations = globSync('**/*.css', { cwd: clientRoot }).flatMap(file => {
      const source = readFileSync(new URL(file, `file://${clientRoot}/`), 'utf8')
      return source.match(/#[\da-f]{3,8}|rgba?\(/giu)?.map(value => `${file}: ${value}`) ?? []
    })
    expect(violations).toEqual([])
  })

  it('keeps component style tags and layout style props out of TSX', () => {
    const violations = globSync('**/*.tsx', { cwd: clientRoot }).flatMap(file => {
      const source = readFileSync(new URL(file, `file://${clientRoot}/`), 'utf8')
      return [...source.matchAll(/<style\b|\bstyle=\{/gu)].map(match => `${file}: ${match[0]}`)
    })
    expect(violations).toEqual([])
  })
})
