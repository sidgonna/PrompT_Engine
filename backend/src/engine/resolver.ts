// ============================================================================
// Step Resolver — resolves each step type to a concrete value
// ============================================================================

import {
  Step,
  Matrix,
  Dimension,
  PromptConfig,
} from "../models/schema";
import {
  buildDependencyGraph,
  topologicalSort,
} from "./dependency";
import {
  resolveSelection,
  resolveMultiSelection,
  pickSynonymExpansion,
  resetSequentialCounters,
} from "../utils/random";
import {
  substituteAll,
  extractVariables,
} from "../utils/variable-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedValueMap {
  [stepId: string]: string;
}

export interface ResolutionContext {
  resolved: ResolvedValueMap;
  skipped: Set<string>;
  warnings: string[];
  stepsExecuted: number;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Execute all steps in dependency order and return a map of step.id → resolved value.
 * Handles graceful skip cascades for disabled steps/dimensions.
 */
export function executeSteps(
  config: PromptConfig,
  matrix: Matrix,
  options?: {
    resetSequentials?: boolean;
    variableOverrides?: Record<string, string>;
  }
): ResolutionContext {
  if (options?.resetSequentials) {
    resetSequentialCounters();
  }

  const enabledSteps = config.steps; // include disabled — we'll skip them in the loop
  const graph = buildDependencyGraph(enabledSteps);
  const sortedIds = topologicalSort(graph, enabledSteps);
  console.log("Execution order sortedIds:", sortedIds);

  const stepMap = new Map(enabledSteps.map((s) => [s.id, s]));
  const dimMap = buildDimensionMap(matrix);

  const ctx: ResolutionContext = {
    resolved: {},
    skipped: new Set(),
    warnings: [],
    stepsExecuted: 0,
  };

  // Build a variable map from dimension names for <variable> substitution
  const variableMap: Record<string, string> = {};
  if (options?.variableOverrides) {
    Object.assign(variableMap, options.variableOverrides);
  }

  for (const stepId of sortedIds) {
    const step = stepMap.get(stepId);
    if (!step) continue;

    // --- Check if step is disabled ---
    if (!step.enabled) {
      ctx.skipped.add(step.id);
      ctx.warnings.push(
        `Step "${step.label}" (${step.id}) is disabled — skipped.`
      );
      continue;
    }

    // --- Check if any dependency was skipped ---
    const hasMissingDep = checkDependencySkip(step, ctx, graph);
    if (hasMissingDep) {
      continue; // already added to skipped + warnings inside the helper
    }

    // --- Resolve based on step type ---
    try {
      const value = resolveStep(step, matrix, dimMap, ctx, variableMap);
      ctx.resolved[step.id] = value;
      ctx.stepsExecuted++;

      // Also populate variableMap with step label as key for <variable> lookup
      // This allows later steps to reference earlier steps via <step_label>
      const sanitizedLabel = step.label
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_");
      variableMap[sanitizedLabel] = value;
      // Provide exact case label to be safe for cases with spaces intact or caps matching
      variableMap[step.label] = value;

      // If step has a dimensionRef, map the dimension name to allow easy Excel-like extraction
      if (step.dimensionRef) {
        const dim = dimMap.get(step.dimensionRef);
        if (dim) {
          const sanitizedDimName = dim.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
          variableMap[sanitizedDimName] = value;
          variableMap[dim.name] = value; // Fallback mapping for exact match support like <SubTopic>
        }
      }

      // If step has an outputColumn, add that to the variable map too
      if (step.outputColumn) {
        variableMap[step.outputColumn] = value;
      }
    } catch (err: any) {
      ctx.warnings.push(
        `Step "${step.label}" (${step.id}) failed: ${err.message}`
      );
      ctx.skipped.add(step.id);
    }
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Per-type resolution
// ---------------------------------------------------------------------------

function resolveStep(
  step: Step,
  matrix: Matrix,
  dimMap: Map<string, Dimension>,
  ctx: ResolutionContext,
  variableMap: Record<string, string>
): string {
  switch (step.type) {
    case "pick":
      return resolvePick(step, dimMap, ctx);

    case "use_similar":
      return resolveUseSimilar(step, dimMap, ctx);

    case "ref":
      return resolveRef(step, ctx, variableMap);

    case "generative":
      return resolveGenerative(step, ctx, variableMap);

    case "constraint":
      return resolveConstraint(step, ctx, variableMap);

    default:
      throw new Error(`Unknown step type: "${step.type}"`);
  }
}

/**
 * Pick: select one or more values from a dimension.
 */
function resolvePick(
  step: Step,
  dimMap: Map<string, Dimension>,
  ctx: ResolutionContext
): string {
  const dim = getDimensionForStep(step, dimMap);

  if (!dim.enabled) {
    ctx.skipped.add(step.id);
    ctx.warnings.push(
      `Dimension "${dim.name}" is disabled — step "${step.label}" skipped.`
    );
    throw new Error(`Dimension "${dim.name}" is disabled.`);
  }

  const count = step.pickCount ?? 1;
  if (count === 1) {
    return resolveSelection(dim);
  }

  const values = resolveMultiSelection(dim, count);
  return values.join(", ");
}

/**
 * Use Similar: select a value and flag it for synonym expansion.
 */
function resolveUseSimilar(
  step: Step,
  dimMap: Map<string, Dimension>,
  ctx: ResolutionContext
): string {
  const dim = getDimensionForStep(step, dimMap);

  if (!dim.enabled) {
    ctx.skipped.add(step.id);
    ctx.warnings.push(
      `Dimension "${dim.name}" is disabled — step "${step.label}" skipped.`
    );
    throw new Error(`Dimension "${dim.name}" is disabled.`);
  }

  // Pick a value
  const selectedValue = resolveSelection(dim);

  // Find the DimensionValue object
  const dimValue = dim.values.find((v) => v.value === selectedValue);

  if (dimValue) {
    // Try synonym expansion
    const expanded = pickSynonymExpansion(dim, dimValue);
    if (expanded !== selectedValue) {
      return `${expanded} (similar to ${selectedValue})`;
    }
  }

  // Fallback: append synonym hint for the LLM
  return `${selectedValue} (or something similar)`;
}

/**
 * Ref: resolve by substituting referenced step outputs into the template.
 */
function resolveRef(
  step: Step,
  ctx: ResolutionContext,
  variableMap: Record<string, string>
): string {
  if (!step.template) {
    throw new Error(`Ref step "${step.label}" has no template.`);
  }

  return substituteAll(step.template, variableMap, ctx.resolved);
}

/**
 * Generative: embed the generative instruction verbatim.
 * Variables and step refs in the instruction are resolved first.
 */
function resolveGenerative(
  step: Step,
  ctx: ResolutionContext,
  variableMap: Record<string, string>
): string {
  const instruction =
    step.generativeInstruction ?? step.template ?? "";

  if (!instruction) {
    throw new Error(
      `Generative step "${step.label}" has no instruction or template.`
    );
  }

  console.log(`[resolveGenerative] step: ${step.label}`);
  console.log(`[resolveGenerative] variableMap keys: ${Object.keys(variableMap).join(', ')}`);
  
  // Substitute any variables/refs in the instruction itself
  return substituteAll(instruction, variableMap, ctx.resolved);
}

/**
 * Constraint: validate constraints, then resolve the template.
 */
function resolveConstraint(
  step: Step,
  ctx: ResolutionContext,
  variableMap: Record<string, string>
): string {
  // Validate each constraint against the current resolved map
  if (step.constraints && step.constraints.length > 0) {
    for (const constraint of step.constraints) {
      const actualValue =
        ctx.resolved[constraint.field] ?? variableMap[constraint.field];
      if (!evaluateConstraint(constraint.operator, actualValue, constraint.value)) {
        throw new Error(
          `Constraint violation in step "${step.label}": ` +
            `${constraint.field} ${constraint.operator} ${constraint.value} ` +
            `(actual: ${actualValue})`
        );
      }
    }
  }

  // Resolve template with current values
  if (!step.template) {
    throw new Error(`Constraint step "${step.label}" has no template.`);
  }

  return substituteAll(step.template, variableMap, ctx.resolved);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDimensionMap(matrix: Matrix): Map<string, Dimension> {
  const map = new Map<string, Dimension>();
  for (const dim of matrix.dimensions) {
    map.set(dim.id, dim);
    // Also map by name for convenient <variable> lookup
    map.set(dim.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"), dim);
  }
  return map;
}

function getDimensionForStep(
  step: Step,
  dimMap: Map<string, Dimension>
): Dimension {
  if (!step.dimensionRef) {
    throw new Error(
      `Step "${step.label}" (type: ${step.type}) has no dimensionRef.`
    );
  }

  const dim = dimMap.get(step.dimensionRef);
  if (!dim) {
    throw new Error(
      `Dimension "${step.dimensionRef}" not found for step "${step.label}".`
    );
  }

  return dim;
}

function checkDependencySkip(
  step: Step,
  ctx: ResolutionContext,
  graph: { edges: { from: string; to: string }[] }
): boolean {
  // Find all deps of this step
  const deps = graph.edges
    .filter((e) => e.to === step.id)
    .map((e) => e.from);

  for (const depId of deps) {
    if (ctx.skipped.has(depId)) {
      ctx.skipped.add(step.id);
      ctx.warnings.push(
        `Step "${step.label}" (${step.id}) skipped because dependency ` +
          `"${depId}" was skipped or disabled (cascade skip).`
      );
      return true;
    }
  }

  // Also check for implicit dependencies from stepRefs
  if (step.stepRefs) {
    for (const ref of step.stepRefs) {
      if (ctx.skipped.has(ref)) {
        ctx.skipped.add(step.id);
        ctx.warnings.push(
          `Step "${step.label}" (${step.id}) skipped because referenced ` +
            `step "${ref}" was skipped or disabled (cascade skip).`
        );
        return true;
      }
    }
  }

  return false;
}

function evaluateConstraint(
  operator: string,
  actual: any,
  expected: any
): boolean {
  switch (operator) {
    case "eq":
      return actual == expected;
    case "neq":
      return actual != expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "in":
      return Array.isArray(expected)
        ? expected.includes(actual)
        : String(expected).includes(String(actual));
    case "not_in":
      return Array.isArray(expected)
        ? !expected.includes(actual)
        : !String(expected).includes(String(actual));
    default:
      return true;
  }
}
