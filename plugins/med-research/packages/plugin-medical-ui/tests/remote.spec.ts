/**
 * Wire contract of the browser Remote client (SPEC §30). A fake caller pins the
 * endpoint, the named arguments, cancellation forwarding, and the error
 * unwrapping, so a renamed endpoint or argument field fails here rather than in
 * the browser.
 */

import { describe, expect, it, vi } from 'vitest'
import { createMedRemote, MedRemoteError, type RemoteCallResult } from '../src/client/remote.ts'

interface Call {
  channel: string
  endpoint: string
  payload: unknown
  signal: AbortSignal | undefined
}

function recordingCaller(result: RemoteCallResult = { ok: true, value: null }): {
  caller: { call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RemoteCallResult> }
  calls: Call[]
} {
  const calls: Call[] = []
  return {
    calls,
    caller: {
      async call(channel, endpoint, payload, signal) {
        calls.push({ channel, endpoint, payload, signal })
        return result
      },
    },
  }
}

describe('med Remote client (SPEC §30)', () => {
  it('addresses every namespace and sends named arguments', async () => {
    const { caller, calls } = recordingCaller()
    const remote = createMedRemote(caller)

    await remote.projects.list()
    await remote.projects.get('project-1' as never)
    await remote.projects.create({ name: 'PONV' })
    await remote.literature.search({ projectId: 'project-1', query: 'PONV', purpose: 'primary' } as never)
    await remote.papers.sections('doc-1' as never)
    await remote.papers.search('paper-1' as never, 'nausea')
    await remote.evidence.verify('evidence-1' as never, 'VERIFIED')
    await remote.datasets.profile('dataset-1' as never)
    await remote.statistics.generateCode('run-1' as never, 'print(1)')
    await remote.artifacts.get('artifact-1' as never)

    expect(calls.map(call => [call.channel, call.endpoint])).toEqual([
      ['/api', 'medProjects/list'],
      ['/api', 'medProjects/get'],
      ['/api', 'medProjects/create'],
      ['/api', 'medLiterature/search'],
      ['/api', 'medPapers/sections'],
      ['/api', 'medPapers/search'],
      ['/api', 'medEvidence/verify'],
      ['/api', 'medDatasets/profile'],
      ['/api', 'medStatistics/generateCode'],
      ['/api', 'medArtifacts/get'],
    ])
    expect(calls[1]!.payload).toEqual({ args: { id: 'project-1' } })
    expect(calls[2]!.payload).toEqual({ args: { input: { name: 'PONV' } } })
    expect(calls[5]!.payload).toEqual({ args: { id: 'paper-1', query: 'nausea' } })
    expect(calls[6]!.payload).toEqual({ args: { id: 'evidence-1', verdict: 'VERIFIED' } })
    expect(calls[8]!.payload).toEqual({ args: { id: 'run-1', code: 'print(1)' } })
  })

  it('forwards cancellation to the connection caller', async () => {
    const { caller, calls } = recordingCaller()
    const controller = new AbortController()
    await createMedRemote(caller).projects.list(controller.signal)
    expect(calls[0]!.signal).toBe(controller.signal)
  })

  it('returns the host value on success', async () => {
    const { caller } = recordingCaller({ ok: true, value: [{ id: 'project-1' }] })
    await expect(createMedRemote(caller).projects.list()).resolves.toEqual([{ id: 'project-1' }])
  })

  it('raises MedRemoteError with the host code and details', async () => {
    const { caller } = recordingCaller({
      ok: false,
      error: { code: 'PROJECT_NOT_FOUND', message: 'no project project-9', details: { id: 'project-9' } },
    })
    const failure = await createMedRemote(caller).projects.get('project-9' as never).catch(error => error)
    expect(failure).toBeInstanceOf(MedRemoteError)
    expect(failure).toMatchObject({
      code: 'PROJECT_NOT_FOUND',
      message: 'no project project-9',
      details: { id: 'project-9' },
    })
    expect(vi.isMockFunction(caller.call)).toBe(false)
  })
})
