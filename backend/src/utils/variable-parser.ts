// ============================================================================
// Variable Parser — extracts and substitutes <variable> and {step_N} patterns
// ============================================================================

/**
 * Regex to match <variable> placeholders in step templates.
 * Matches: <emotion>, <person_type>, <+ve/-ve>, <operations/action>
 */
const VARIABLE_PATTERN = /<([^>]+)>/g;

/**
 * Regex to match {step_<id>} references in step templates.
 * Matches: {step_abc123}, {step_1}
 */
const STEP_REF_PATTERN = /\{step_([a-zA-Z0-9_-]+)\}/g;

/**
 * Extract all <variable> names from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_PATTERN.source, "g");

  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

/**
 * Extract all {step_<id>} references from a template string.
 */
export function extractStepRefs(template: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(STEP_REF_PATTERN.source, "g");

  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

/**
 * Substitute <variable> placeholders with values from a map.
 * Variables not found in the map are left as-is.
 */
export function substituteVariables(
  template: string,
  variableMap: Record<string, string>
): string {
  return template.replace(
    new RegExp(VARIABLE_PATTERN.source, "g"),
    (fullMatch, varName) => {
      return variableMap[varName] !== undefined ? variableMap[varName] : fullMatch;
    }
  );
}

/**
 * Substitute {step_<id>} references with resolved step values.
 * References not found in the map are left as-is.
 */
export function substituteStepRefs(
  template: string,
  resolvedSteps: Record<string, string>
): string {
  return template.replace(
    new RegExp(STEP_REF_PATTERN.source, "g"),
    (fullMatch, stepId) => {
      return resolvedSteps[stepId] !== undefined ? resolvedSteps[stepId] : fullMatch;
    }
  );
}

/**
 * Combined substitution: replaces both <variable> and {step_<id>} patterns.
 */
export function substituteAll(
  template: string,
  variableMap: Record<string, string>,
  resolvedSteps: Record<string, string>
): string {
  let result = substituteVariables(template, variableMap);
  result = substituteStepRefs(result, resolvedSteps);
  return result;
}

/**
 * Check if a template has any unresolved placeholders.
 */
export function hasUnresolvedPlaceholders(text: string): boolean {
  return VARIABLE_PATTERN.test(text) || STEP_REF_PATTERN.test(text);
}

/**
 * Get all unresolved placeholder names from a text.
 */
export function getUnresolvedPlaceholders(text: string): {
  variables: string[];
  stepRefs: string[];
} {
  return {
    variables: extractVariables(text),
    stepRefs: extractStepRefs(text),
  };
}
