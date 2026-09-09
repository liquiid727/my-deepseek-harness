/**
 * Shared model-facing tool result envelope. Every Med Research tool returns
 * `{ ok, result }` or `{ ok, error }` as machine-readable JSON, so a failure is
 * never mistaken for an empty success (Gate 4, SPEC §46).
 * @module @medresearch/dsh-medical-contracts/src/tool-envelope
 */

/** JSON value as the tool output schema admits it. */
export type ToolJson = null | boolean | number | string | ToolJson[] | { [key: string]: ToolJson }

/**
 * Widen a plain domain value to the tool JSON surface. Domain records are
 * JSON-serializable; optional fields that are `undefined` are dropped by
 * serialization, which is exactly what the schema describes.
 * @param value - Any JSON-serializable domain value.
 * @returns the same value typed as {@link ToolJson}.
 */
export function asToolJson(value: unknown): ToolJson {
  return value as ToolJson
}

/** Output schema every Med Research tool declares. */
export const TOOL_ENVELOPE_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', const: true, required: true, description: 'The call completed successfully.' },
        result: { type: 'json', required: true, description: 'Machine-readable result.' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', const: false, required: true, description: 'The call failed with a domain error.' },
        error: { type: 'json', required: true, description: 'DomainError object explaining the failure.' },
      },
    },
  ],
} as const

/**
 * Render one envelope as a JSON text block.
 * @param _args - Tool arguments; unused.
 * @param value - Envelope value.
 * @returns one text content block.
 */
export function renderToolEnvelope(_args: unknown, value: unknown): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: JSON.stringify(value) }]
}
