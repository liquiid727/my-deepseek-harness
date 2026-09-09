import { describe, expect, it } from 'vitest'
import { RestrictedProcessRunner } from '@medresearch/dsh-medical-runner-container'
import type { StatisticsRunInput } from '@medresearch/dsh-medical-contracts'

const runner = new RestrictedProcessRunner({ pythonPath: 'python3', isolationLevel: 'restricted-process' })
const limits = { timeoutMs: 20_000, cpuSeconds: 10, memoryMb: 512, maxOutputBytes: 50_000 }

function fixture(name: string): string {
  return new URL(`./fixtures/${name}`, import.meta.url).pathname
}

async function run(dataset: string, code: string): Promise<Record<string, number>> {
  const result = await runner.execute({ datasetPath: fixture(dataset), code, limits, allowlist: [] } satisfies StatisticsRunInput)
  expect(result.status).toBe('succeeded')
  return result.resultJson as Record<string, number>
}

const LINEAR = `import csv, json, os
rows = list(csv.DictReader(open(os.environ['MED_DATASET_PATH'])))
xs = [float(r['x']) for r in rows]
ys = [float(r['y']) for r in rows]
n = len(xs); mx = sum(xs)/n; my = sum(ys)/n
slope = sum((x-mx)*(y-my) for x, y in zip(xs, ys)) / sum((x-mx)**2 for x in xs)
intercept = my - slope*mx
ss_res = sum((y - (slope*x + intercept))**2 for x, y in zip(xs, ys))
ss_tot = sum((y - my)**2 for y in ys)
json.dump({'slope': slope, 'intercept': intercept, 'r2': 1 - ss_res/ss_tot}, open(os.path.join(os.environ['MED_OUTPUT_DIR'], 'result.json'), 'w'))
`

const CATEGORICAL = `import csv, json, os
rows = list(csv.DictReader(open(os.environ['MED_DATASET_PATH'])))
groups = sorted({r['group'] for r in rows}); outcomes = sorted({r['outcome'] for r in rows})
obs = [[sum(1 for r in rows if r['group'] == g and r['outcome'] == o) for o in outcomes] for g in groups]
rt = [sum(row) for row in obs]; ct = [sum(obs[i][j] for i in range(len(obs))) for j in range(len(outcomes))]; n = sum(rt)
chi = sum((obs[i][j] - rt[i]*ct[j]/n)**2 / (rt[i]*ct[j]/n) for i in range(len(obs)) for j in range(len(outcomes)))
json.dump({'chi2': chi, 'table': obs}, open(os.path.join(os.environ['MED_OUTPUT_DIR'], 'result.json'), 'w'))
`

const LOGISTIC = `import csv, json, math, os
rows = list(csv.DictReader(open(os.environ['MED_DATASET_PATH'])))
xs = [float(r['exposure']) for r in rows]; ys = [float(r['outcome']) for r in rows]
b0 = b1 = 0.0
for _ in range(50):
    g0 = g1 = h00 = h01 = h11 = 0.0
    for x, y in zip(xs, ys):
        p = 1/(1+math.exp(-(b0+b1*x))); w = p*(1-p)
        g0 += (y-p); g1 += (y-p)*x; h00 += w; h01 += w*x; h11 += w*x*x
    det = h00*h11 - h01*h01
    if det == 0: break
    b0 += (h11*g0 - h01*g1)/det; b1 += (-h01*g0 + h00*g1)/det
json.dump({'intercept': b0, 'beta': b1, 'odds_ratio': math.exp(b1)}, open(os.path.join(os.environ['MED_OUTPUT_DIR'], 'result.json'), 'w'))
`

describe('SPEC §57 statistics fixtures (fixed dataset + confirmed results)', () => {
  it('linear regression recovers the generating line', async () => {
    const result = await run('linear.csv', LINEAR)
    expect(result.slope).toBeCloseTo(2, 6)
    expect(result.intercept).toBeCloseTo(1, 6)
    expect(result.r2).toBeCloseTo(1, 6)
  })

  it('categorical comparison reproduces the chi-square statistic', async () => {
    const result = await run('categorical.csv', CATEGORICAL)
    expect(result.table).toEqual([[2, 3], [3, 2]])
    expect(result.chi2).toBeCloseTo(0.4, 6)
  })

  it('binary logistic regression reproduces the odds ratio', async () => {
    const result = await run('logistic.csv', LOGISTIC)
    expect(result.intercept).toBeCloseTo(-0.405465, 5)
    expect(result.beta).toBeCloseTo(1.791759, 5)
    expect(result.odds_ratio).toBeCloseTo(6, 5)
  })
})
