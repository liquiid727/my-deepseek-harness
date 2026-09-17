/**
 * Focused JSON Schema 2020-12 validator for skill input/output schemas
 * (SPEC-R001-S07 §8). The Med Research skills store author-provided schemas,
 * so the validator must reject remote `$ref` (only `#`-anchored local refs are
 * allowed) and report the exact JSON path of every failure so the builder can
 * point at the offending field.
 *
 * This implements the 2020-12 subset the catalog actually uses: `type`,
 * `properties`, `required`, `additionalProperties`, `items`, `prefixItems`,
 * `enum`, `const`, numeric/string/array/object bounds, `$defs`, and local
 * `$ref`. It is intentionally strict about remote references and lenient about
 * unknown keywords, so a future 2020-12 keyword does not break authored skills.
 * @module @medresearch/dsh-plugin-skills/src/json-schema
 */

/** One precise schema violation, located by its JSON pointer. */
export interface JsonSchemaError {
  /** JSON pointer to the failing value, empty string for the root. */
  path: string
  /** Human-readable reason the value failed the schema. */
  message: string
}

/** A JSON Schema document (2020-12 subset). */
export type JsonSchema = boolean | { readonly [key: string]: unknown }

/**
 * Collect every remote `$ref` inside a schema tree. A ref is remote when its
 * value is a string that does not start with `#` (local refs are `#/...`).
 * @param schema - Schema node to walk.
 * @returns the list of offending remote ref strings (empty when none).
 */
export function collectRemoteRefs(schema: unknown): string[] {
  const found: string[] = []
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const record = node as Record<string, unknown>
    const ref = record['$ref']
    if (typeof ref === 'string' && !ref.startsWith('#')) found.push(ref)
    for (const value of Object.values(record)) walk(value)
  }
  walk(schema)
  return found
}

/**
 * Validate one value against a schema, returning every violation.
 * @param schema - JSON Schema (2020-12 subset) or a boolean schema.
 * @param value - Value to validate.
 * @param root - Root schema for `$ref` resolution (defaults to `schema`).
 * @param path - JSON pointer prefix for nested errors.
 * @returns the violations; an empty array means the value is valid.
 */
export function validateAgainstSchema(schema: JsonSchema, value: unknown, root: JsonSchema = schema, path = ''): JsonSchemaError[] {
  if (schema === true) return []
  if (schema === false) return [{ path, message: 'value does not satisfy schema (always invalid)' }]
  const node = schema as Record<string, unknown>

  if (typeof node['$ref'] === 'string') {
    const ref = node['$ref'] as string
    if (!ref.startsWith('#')) return [{ path, message: `remote $ref is not allowed: ${ref}` }]
    const resolved = resolveLocalRef(root, ref)
    if (resolved === undefined) return [{ path, message: `unresolvable local $ref: ${ref}` }]
    return validateAgainstSchema(resolved, value, root, path)
  }

  const type = node['type']
  if (type !== undefined) {
    const types = Array.isArray(type) ? (type as string[]) : [type as string]
    if (!types.some(t => matchesType(t, value))) {
      return [{ path, message: `expected type ${types.join('|')}, got ${typeName(value)}` }]
    }
  }

  const errors: JsonSchemaError[] = []

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const properties = node['properties']
    if (properties !== undefined && typeof properties === 'object') {
      for (const [key, childSchema] of Object.entries(properties as Record<string, unknown>)) {
        if (key in record) {
          errors.push(...validateAgainstSchema(childSchema as JsonSchema, record[key], root, join(path, key)))
        }
      }
    }
    const required = node['required']
    if (Array.isArray(required)) {
      for (const key of required as string[]) {
        if (!(key in record)) errors.push({ path: join(path, key), message: 'required property is missing' })
      }
    }
    const additional = node['additionalProperties']
    if (additional !== undefined) {
      const allowed = properties !== undefined ? Object.keys(properties as Record<string, unknown>) : []
      for (const key of Object.keys(record)) {
        if (allowed.includes(key)) continue
        if (additional === false) errors.push({ path: join(path, key), message: 'additional property is not allowed' })
        else if (additional !== true) errors.push(...validateAgainstSchema(additional as JsonSchema, record[key], root, join(path, key)))
      }
    }
    const minProps = node['minProperties']
    if (typeof minProps === 'number' && Object.keys(record).length < minProps) errors.push({ path, message: `must have at least ${minProps} properties` })
    const maxProps = node['maxProperties']
    if (typeof maxProps === 'number' && Object.keys(record).length > maxProps) errors.push({ path, message: `must have at most ${maxProps} properties` })
  }

  if (Array.isArray(value)) {
    const items = node['items']
    if (items !== undefined && typeof items === 'object') {
      value.forEach((item, index) => errors.push(...validateAgainstSchema(items as JsonSchema, item, root, join(path, String(index)))))
    }
    const prefixItems = node['prefixItems']
    if (Array.isArray(prefixItems)) {
      prefixItems.forEach((childSchema, index) => {
        if (index < value.length) errors.push(...validateAgainstSchema(childSchema as JsonSchema, value[index], root, join(path, String(index))))
      })
    }
    const minItems = node['minItems']
    if (typeof minItems === 'number' && value.length < minItems) errors.push({ path, message: `must have at least ${minItems} items` })
    const maxItems = node['maxItems']
    if (typeof maxItems === 'number' && value.length > maxItems) errors.push({ path, message: `must have at most ${maxItems} items` })
    if (node['uniqueItems'] === true) {
      const seen = new Set(value.map(v => JSON.stringify(v)))
      if (seen.size !== value.length) errors.push({ path, message: 'items must be unique' })
    }
  }

  if (typeof value === 'string') {
    const minLength = node['minLength']
    if (typeof minLength === 'number' && value.length < minLength) errors.push({ path, message: `must be at least ${minLength} characters` })
    const maxLength = node['maxLength']
    if (typeof maxLength === 'number' && value.length > maxLength) errors.push({ path, message: `must be at most ${maxLength} characters` })
    const pattern = node['pattern']
    if (typeof pattern === 'string') {
      try {
        if (!new RegExp(pattern).test(value)) errors.push({ path, message: `must match pattern ${pattern}` })
      } catch {
        // An invalid pattern in the schema is an authoring error; do not fail the value on it.
      }
    }
  }

  if (typeof value === 'number') {
    const minimum = node['minimum']
    if (typeof minimum === 'number' && value < minimum) errors.push({ path, message: `must be >= ${minimum}` })
    const maximum = node['maximum']
    if (typeof maximum === 'number' && value > maximum) errors.push({ path, message: `must be <= ${maximum}` })
    const exclusiveMinimum = node['exclusiveMinimum']
    if (typeof exclusiveMinimum === 'number' && value <= exclusiveMinimum) errors.push({ path, message: `must be > ${exclusiveMinimum}` })
    const exclusiveMaximum = node['exclusiveMaximum']
    if (typeof exclusiveMaximum === 'number' && value >= exclusiveMaximum) errors.push({ path, message: `must be < ${exclusiveMaximum}` })
  }

  const enumValues = node['enum']
  if (Array.isArray(enumValues) && !enumValues.some(e => jsonEquals(e, value))) {
    errors.push({ path, message: `value is not one of the allowed enum values` })
  }
  if ('const' in node) {
    if (!jsonEquals(node['const'], value)) errors.push({ path, message: `value must equal the const ${JSON.stringify(node['const'])}` })
  }

  return errors
}

/** Whether a JSON Schema type name matches a runtime value. */
function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array': return Array.isArray(value)
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number' && !Number.isNaN(value)
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'boolean': return typeof value === 'boolean'
    case 'null': return value === null
    default: return false
  }
}

/** JSON pointer segment join. */
function join(base: string, segment: string): string {
  return base === '' ? `/${segment}` : `${base}/${segment}`
}

/** Runtime type label for error messages. */
function typeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/** Resolve a `#/a/b` local ref against the root schema. */
function resolveLocalRef(root: JsonSchema, ref: string): JsonSchema | undefined {
  if (ref === '#') return root
  if (!ref.startsWith('#/')) return undefined
  const segments = ref.slice(2).split('/').map(decodeSegment)
  let current: unknown = root
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current as JsonSchema
}

/** JSON Pointer unescaping (`~1` → `/`, `~0` → `~`). */
function decodeSegment(segment: string): string {
  return segment.replace(/~1/gu, '/').replace(/~0/gu, '~')
}

/** Structural JSON equality for `enum`/`const` checks. */
function jsonEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (typeof left !== typeof right) return false
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => jsonEquals(item, right[index]))
  }
  if (left !== null && typeof left === 'object' && right !== null && typeof right === 'object') {
    const l = left as Record<string, unknown>
    const r = right as Record<string, unknown>
    const keys = [...new Set([...Object.keys(l), ...Object.keys(r)])]
    return keys.every(key => jsonEquals(l[key], r[key]))
  }
  return false
}
