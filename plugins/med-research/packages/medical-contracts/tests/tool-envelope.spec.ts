import { validateJsonSchemaValue, valueSchemaSpecToJsonSchema } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { TOOL_ENVELOPE_SCHEMA } from '../src/tool-envelope.ts'

describe('shared tool envelope schema', () => {
  it('accepts exactly one complete success or failure branch', () => {
    const schema = valueSchemaSpecToJsonSchema(TOOL_ENVELOPE_SCHEMA)

    expect(validateJsonSchemaValue(schema, { ok: true, result: { value: 1 } })).toEqual([])
    expect(validateJsonSchemaValue(schema, { ok: false, error: { code: 'DOMAIN_ERROR' } })).toEqual([])
    expect(validateJsonSchemaValue(schema, { ok: true })).not.toEqual([])
    expect(validateJsonSchemaValue(schema, { ok: false })).not.toEqual([])
    expect(validateJsonSchemaValue(schema, { ok: true, result: {}, error: {} })).not.toEqual([])
  })
})
