import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const palette = readFileSync(
  fileURLToPath(new URL('../src/styles/design-platform.css', import.meta.url)),
  'utf8',
)

function luminance([red, green, blue]: readonly number[]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel! / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(left: readonly number[], right: readonly number[]): number {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a)
  return (lighter! + 0.05) / (darker! + 0.05)
}

describe('product design tokens', () => {
  it('defines the semantic accent and accessible status labels for both palettes', () => {
    for (const token of [
      '--dsw-alias-accent-primary',
      '--dsw-alias-accent-strong',
      '--dsw-alias-accent-hover',
      '--dsw-alias-accent-soft',
      '--dsw-alias-focus-ring',
      '--dsw-alias-label-on-accent',
      '--dsw-alias-state-error-label',
      '--dsw-alias-state-success-label',
      '--dsw-alias-state-warn-label',
    ]) {
      expect(palette.match(new RegExp(`${token}:`, 'g'))).toHaveLength(2)
    }
  })

  it('does not retain the ambiguous brand-primary aliases', () => {
    expect(palette).not.toContain('--dsw-alias-brand-primary')
    expect(palette).not.toContain('--dsw-alias-brand-primary-new-colorprimary-new-color')
  })

  it('keeps primary action labels above WCAG AA contrast in both palettes', () => {
    for (const value of ['rgb(33, 107, 208)', 'rgb(25, 91, 180)', 'rgb(117, 173, 250)']) {
      expect(palette).toContain(value)
    }
    expect(contrast([255, 255, 255], [33, 107, 208])).toBeGreaterThanOrEqual(4.5)
    expect(contrast([255, 255, 255], [25, 91, 180])).toBeGreaterThanOrEqual(4.5)
    expect(contrast([15, 17, 21], [117, 173, 250])).toBeGreaterThanOrEqual(4.5)
  })
})
