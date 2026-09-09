import { describe, expect, it } from 'vitest'
import { ChartSpecError, renderChartSvg, type ChartSpec } from '../src/charts.ts'

describe('P0 chart templates (PRD §26/§36)', () => {
  const specs: ChartSpec[] = [
    { type: 'histogram', bins: [{ label: '0–1', count: 2 }, { label: '1–2', count: 3 }] },
    { type: 'box_plot', min: 1, q1: 2, median: 3, q3: 4, max: 5 },
    { type: 'bar', categories: ['A', 'B'], values: [2, 4] },
    { type: 'scatter', points: [{ x: 1, y: 2 }, { x: 2, y: 5 }] },
  ]

  it.each(specs)('renders a standalone SVG for $type', spec => {
    const svg = renderChartSvg(spec)
    expect(svg).toMatch(/^<svg /u)
    expect(svg).toContain('role="img"')
    expect(svg).not.toContain('NaN')
    expect(svg).not.toContain('undefined')
  })

  it('rejects malformed aggregate input', () => {
    expect(() => renderChartSvg({ type: 'bar', categories: ['A'], values: [] })).toThrow(ChartSpecError)
    expect(() => renderChartSvg({ type: 'box_plot', min: 4, q1: 2, median: 3, q3: 5, max: 6 })).toThrow(/ordered/u)
    expect(() => renderChartSvg({ type: 'histogram', bins: [{ label: 'x', count: -1 }] })).toThrow(ChartSpecError)
  })
})
