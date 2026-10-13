/**
 * Values allowed in a step input. They're written into the .bru DSL as text, so this
 * allowlist is a code-execution boundary: no braces, brackets, newlines, & or ?.
 */
export const STEP_INPUT_VALUE_PATTERN = /^[\p{L}\p{N} _\-.:/#@+',()]{1,256}$/u;

export interface StepInputError {
  field: string;
  message: string;
}

/** The input keys must be exactly the step's `input` parameters from the catalog. */
export const validateStepInputs = (
  expectedNames: string[],
  inputs: Record<string, unknown>
): StepInputError[] => {
  const errors: StepInputError[] = [];
  const expected = new Set(expectedNames);

  for (const name of expectedNames) {
    if (!Object.prototype.hasOwnProperty.call(inputs, name)) {
      errors.push({ field: `inputs.${name}`, message: 'Enter a value.' });
    }
  }
  for (const [name, value] of Object.entries(inputs)) {
    if (!expected.has(name)) {
      errors.push({ field: `inputs.${name}`, message: "This step doesn't take this input." });
    } else if (typeof value !== 'string' || !STEP_INPUT_VALUE_PATTERN.test(value)) {
      errors.push({
        field: `inputs.${name}`,
        message: "Use up to 256 letters, numbers, spaces or . - _ : / # @ + ' , ( )",
      });
    }
  }
  return errors;
};

const QUERY_BLOCK_START = /^params:query\s*\{/;
const BLOCK_END = /^\}/;
// `name: [ENTER …]` (disabled params start with ~ and never match).
const INPUT_PARAM_LINE = /^\s*([^\s:~]+)\s*:\s*(\[ENTER[^\]]*\])\s*$/i;

/**
 * Replaces each input's exact `[ENTER …]` token, found in params:query, in the url line and
 * params:query only. Descriptor steps read req.url before interpolation, which is why this
 * is a text substitution and not a {{variable}}.
 */
export const substituteStepInputs = (bruContent: string, inputs: Record<string, string>): string => {
  const lines = bruContent.split('\n');
  const tokens = new Map<string, string>();

  let inQuery = false;
  for (const line of lines) {
    if (QUERY_BLOCK_START.test(line)) inQuery = true;
    else if (inQuery && BLOCK_END.test(line)) inQuery = false;
    else if (inQuery) {
      const match = line.match(INPUT_PARAM_LINE);
      if (match && Object.prototype.hasOwnProperty.call(inputs, match[1]))
        tokens.set(match[2], inputs[match[1]]);
    }
  }

  inQuery = false;
  return lines
    .map((line) => {
      if (QUERY_BLOCK_START.test(line)) {
        inQuery = true;
        return line;
      }
      if (inQuery && BLOCK_END.test(line)) {
        inQuery = false;
        return line;
      }
      if (!inQuery && !/^\s*url:/.test(line)) return line;
      let substituted = line;
      for (const [token, value] of tokens) substituted = substituted.split(token).join(value);
      return substituted;
    })
    .join('\n');
};
