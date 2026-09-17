/**
 * S05 P1 chart coverage (SPEC-R001-S05-004). The spec requires Forest Plot,
 * ROC, Correlation, and Kaplan-Meier alongside the P0 templates, an explicit
 * disable-with-reason for a chart that does not apply, and a refusal to publish
 * a figure that carries scripting, an external reference, or no provenance.
 */

import { describe, expect, it } from 'vitest'
import {
  assertPublishableChart,
  assertSafeSvg,
  chartApplicability,
  ChartSpecError,
  renderChartSvg,
  type ChartSpec,
} from '../src/charts.ts'

const svgOf = (spec: ChartSpec): string => renderChartSvg(spec)

describe('S05 forest plot', () => {
  const base: ChartSpec = {
    type: 'forest_plot',
    scale: 'OR',
    entries: [
      { label: 'Trial A', estimate: 0.54, lower: 0.35, upper: 0.83 },
      { label: 'Trial B', estimate: 0.71, lower: 0.5, upper: 1.01 },
    ],
  }

  it('renders one interval per effect on a shared axis', () => {
    const svg = svgOf(base)
    expect(svg).toContain('<svg')
    expect(svg.split('<rect').length - 1).toBeGreaterThanOrEqual(2)
    expect(svg).toContain('Forest Plot (OR)')
  })

  it('rejects an interval that does not contain its estimate', () => {
    expect(() => svgOf({
      type: 'forest_plot',
      scale: 'OR',
      entries: [{ label: 'Bad', estimate: 2, lower: 0.5, upper: 1.5 }],
    })).toThrow(ChartSpecError)
  })

  it('refuses to combine scales', () => {
    expect(chartApplicability(base, { effectScales: ['OR', 'HR'] }))
      .toEqual({ applicable: false, reason: 'chart.reason.mixedEffectScales' })
    expect(chartApplicability(base, { effectScales: ['OR'] })).toEqual({ applicable: true })
  })
})

describe('S05 ROC', () => {
  const base: ChartSpec = { type: 'roc', auc: 0.82, points: [{ fpr: 0, tpr: 0 }, { fpr: 0.2, tpr: 0.6 }, { fpr: 1, tpr: 1 }] }

  it('renders the curve and reports the AUC', () => {
    const svg = svgOf(base)
    expect(svg).toContain('ROC (AUC 0.82)')
    expect(svg).toContain('<path')
  })

  it('rejects a point outside the unit square and an out-of-range AUC', () => {
    expect(() => svgOf({ ...base, points: [{ fpr: 0, tpr: 0 }, { fpr: 1.2, tpr: 0.5 }] })).toThrow(ChartSpecError)
    expect(() => svgOf({ ...base, auc: 1.5 })).toThrow(ChartSpecError)
  })

  it('is disabled with a reason unless the outcome is binary with predicted probabilities', () => {
    expect(chartApplicability(base, {})).toEqual({ applicable: false, reason: 'chart.reason.needsBinaryOutcome' })
    expect(chartApplicability(base, { hasBinaryOutcome: true }))
      .toEqual({ applicable: false, reason: 'chart.reason.needsPredictedProbability' })
    expect(chartApplicability(base, { hasBinaryOutcome: true, hasPredictedProbabilities: true })).toEqual({ applicable: true })
  })
})

describe('S05 correlation matrix', () => {
  const base: ChartSpec = {
    type: 'correlation',
    method: 'spearman',
    sampleSize: 120,
    cells: [
      { x: 'age', y: 'pain', r: 0.32 },
      { x: 'age', y: 'ponv', r: -0.18 },
      { x: 'pain', y: 'ponv', r: 0.45 },
      { x: 'bmi', y: 'pain', r: 0.05 },
    ],
  }

  it('names the method and sample size', () => {
    const svg = svgOf(base)
    expect(svg).toContain('Correlation (spearman, n=120)')
  })

  it('rejects a coefficient outside [-1, 1] and a non-positive sample size', () => {
    expect(() => svgOf({ ...base, cells: [{ x: 'a', y: 'b', r: 1.4 }] })).toThrow(ChartSpecError)
    expect(() => svgOf({ ...base, sampleSize: 0 })).toThrow(ChartSpecError)
  })

  it('needs at least two numeric variables', () => {
    expect(chartApplicability(base, { numericVariableCount: 1 }))
      .toEqual({ applicable: false, reason: 'chart.reason.needsTwoNumericVariables' })
    expect(chartApplicability(base, { numericVariableCount: 2 })).toEqual({ applicable: true })
  })
})

describe('S05 Kaplan-Meier', () => {
  const base: ChartSpec = {
    type: 'kaplan_meier',
    groups: [
      { label: 'Ondansetron', points: [{ time: 0, survival: 1 }, { time: 2, survival: 0.8 }, { time: 4, survival: 0.74 }] },
      { label: 'Placebo', points: [{ time: 0, survival: 1 }, { time: 2, survival: 0.62 }] },
    ],
  }

  it('renders one step curve per group', () => {
    const svg = svgOf(base)
    expect(svg).toContain('Kaplan-Meier')
    expect(svg).toContain('Ondansetron')
  })

  it('rejects a negative time and a survival outside [0, 1]', () => {
    expect(() => svgOf({ ...base, groups: [{ label: 'A', points: [{ time: -1, survival: 1 }] }] })).toThrow(ChartSpecError)
    expect(() => svgOf({ ...base, groups: [{ label: 'A', points: [{ time: 1, survival: 1.4 }] }] })).toThrow(ChartSpecError)
  })

  it('is disabled with a reason without non-negative time and a 0/1 event column', () => {
    expect(chartApplicability(base, {}))
      .toEqual({ applicable: false, reason: 'chart.reason.needsSurvivalColumns' })
    expect(chartApplicability(base, { hasSurvivalColumns: true })).toEqual({ applicable: true })
  })
})

describe('S05 chart publication safety (SPEC-R001-S05-004)', () => {
  it('accepts a chart the template produced', () => {
    expect(() => assertSafeSvg(svgOf({ type: 'histogram', bins: [{ label: '0-10', count: 4 }] }))).not.toThrow()
  })

  it('rejects scripting, inline handlers, foreign objects, and external references', () => {
    expect(() => assertSafeSvg('<svg><script>alert(1)</script></svg>')).toThrow(/script element/u)
    expect(() => assertSafeSvg('<svg><rect onclick="x()" /></svg>')).toThrow(/inline event handler/u)
    expect(() => assertSafeSvg('<svg><foreignObject /></svg>')).toThrow(/foreignObject element/u)
    expect(() => assertSafeSvg('<svg><image href="https://example.com/a.png" /></svg>')).toThrow(/external reference/u)
    // A same-document reference is fine.
    expect(() => assertSafeSvg('<svg><use href="#glyph" /></svg>')).not.toThrow()
  })

  it('refuses to publish without a run identity or with a mismatched hash', () => {
    expect(() => assertPublishableChart({ analysisRunId: '', hash: 'a', expectedHash: 'a' })).toThrow(/analysis run/u)
    expect(() => assertPublishableChart({ analysisRunId: 'run-1', hash: 'a', expectedHash: 'b' })).toThrow(/hash does not match/u)
    expect(() => assertPublishableChart({ analysisRunId: 'run-1', hash: 'a', expectedHash: 'a' })).not.toThrow()
  })
})
