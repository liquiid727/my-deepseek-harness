import { describe, expect, it } from 'vitest'
import { projectIdSchema, type Project } from '@medresearch/dsh-medical-contracts'
import {
  MEDRESEARCH_DIRECTORY,
  parseProjectFile,
  projectDirectory,
  projectJsonPath,
  projectSlug,
  serializeProjectFile,
} from '../src/project-file.ts'

function project(): Project {
  return {
    id: projectIdSchema.parse('abc-123-def'),
    name: 'PONV 与术后疼痛',
    researchQuestion: 'PONV 与术后疼痛是否相关？',
    keywords: ['PONV'],
    workspacePath: '/tmp/root/ponv-abc12345',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('project file layout (US-001)', () => {
  it('builds a filesystem-safe slug with an id suffix', () => {
    expect(projectSlug('PONV 与术后疼痛', 'abc-123-def')).toBe('ponv-abc123de')
    expect(projectSlug('   ', 'abc-123-def')).toBe('project-abc123de')
    expect(projectSlug('A/B:C', 'zzzzzzzz')).toBe('a-b-c-zzzzzzzz')
  })

  it('places the mirror under <workspace>/.medresearch/project.json', () => {
    const directory = projectDirectory('/tmp/root', 'demo-12345678')
    expect(directory).toBe('/tmp/root/demo-12345678')
    expect(projectJsonPath(directory)).toBe(`/tmp/root/demo-12345678/${MEDRESEARCH_DIRECTORY}/project.json`)
  })

  it('round-trips a project through the envelope', () => {
    const serialized = serializeProjectFile(project())
    expect(serialized.endsWith('\n')).toBe(true)
    expect(parseProjectFile(serialized)).toEqual(project())
  })

  it('rejects an unknown envelope version', () => {
    expect(() => parseProjectFile(JSON.stringify({ schemaVersion: 2, project: project() })))
      .toThrow(/schemaVersion/)
  })

  it('rejects a body whose project fails validation', () => {
    expect(() => parseProjectFile(JSON.stringify({ schemaVersion: 1, project: { id: 'x' } })))
      .toThrow()
  })
})
