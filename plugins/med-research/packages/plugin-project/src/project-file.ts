/**
 * Project directory and `project.json` layout (PRD §8.2, US-001). The file is
 * the on-disk mirror of the project record: `<workspace>/.medresearch/project.json`
 * holds `{ schemaVersion, project }`, so a project survives even when the
 * storage medium is rebuilt. Pure functions only — no filesystem access.
 * @module @medresearch/dsh-plugin-project/src/project-file
 */

import { join } from 'node:path'
import { projectSchema, type Project } from '@medresearch/dsh-medical-contracts'

/** Directory inside a workspace that owns Med Research project data. */
export const MEDRESEARCH_DIRECTORY = '.medresearch'

/** File name of the project mirror. */
export const PROJECT_FILE = 'project.json'

/** Current `project.json` envelope version. */
export const PROJECT_FILE_SCHEMA_VERSION = 1

/** On-disk envelope of one project. */
export interface ProjectFile {
  schemaVersion: number
  project: Project
}

/**
 * Build a filesystem-safe directory name from the project name and id.
 * @param name - User-supplied project name.
 * @param id - Project id; its first eight characters keep names unique.
 * @returns a lowercase slug with a short id suffix.
 */
export function projectSlug(name: string, id: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48)
    .replace(/-+$/u, '')
  const suffix = id.replace(/[^a-zA-Z0-9]/gu, '').slice(0, 8).toLowerCase()
  return base === '' ? `project-${suffix}` : `${base}-${suffix}`
}

/**
 * Absolute directory of one project workspace.
 * @param workspaceRoot - Configured parent directory.
 * @param slug - Result of {@link projectSlug}.
 * @returns the absolute project directory.
 */
export function projectDirectory(workspaceRoot: string, slug: string): string {
  return join(workspaceRoot, slug)
}

/**
 * Absolute path of the project mirror file.
 * @param directory - Project directory.
 * @returns `<directory>/.medresearch/project.json`.
 */
export function projectJsonPath(directory: string): string {
  return join(directory, MEDRESEARCH_DIRECTORY, PROJECT_FILE)
}

/**
 * Serialize one project record for disk.
 * @param project - Stored project record.
 * @returns pretty-printed JSON with a trailing newline.
 */
export function serializeProjectFile(project: Project): string {
  const file: ProjectFile = { schemaVersion: PROJECT_FILE_SCHEMA_VERSION, project }
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * Parse and validate a `project.json` body.
 * @param text - File contents.
 * @returns the project record.
 * @throws Error when the envelope or the project fails validation.
 */
export function parseProjectFile(text: string): Project {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('project.json is not an object')
  }
  const envelope = parsed as Record<string, unknown>
  if (envelope.schemaVersion !== PROJECT_FILE_SCHEMA_VERSION) {
    throw new Error(
      `project.json schemaVersion must be ${PROJECT_FILE_SCHEMA_VERSION}, got ${String(envelope.schemaVersion)}`,
    )
  }
  return projectSchema.parse(envelope.project)
}
