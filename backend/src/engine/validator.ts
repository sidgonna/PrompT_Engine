// ============================================================================
// Validator — pre-execution validation of configs and matrices
// ============================================================================

import {
  PromptConfig,
  Matrix,
  Step,
  Dimension,
  ValidationResult,
  ValidationError,
} from "../models/schema";
import { buildDependencyGraph } from "./dependency";
import { extractVariables, extractStepRefs } from "../utils/variable-parser";

/**
 * Validate a config + matrix pair before execution.
 * Returns all errors and warnings without throwing.
 */
export function validateConfig(
  config: PromptConfig,
  matrix: Matrix
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // --- 1. Basic config checks ---
  if (!config.steps || config.steps.length === 0) {
    errors.push({
      code: "NO_STEPS",
      message: "Config has no steps defined.",
    });
  }

  if (!config.matrixId) {
    errors.push({
      code: "NO_MATRIX_ID",
      message: "Config has no matrixId.",
    });
  }

  // --- 2. Matrix checks ---
  if (!matrix.dimensions || matrix.dimensions.length === 0) {
    errors.push({
      code: "EMPTY_MATRIX",
      message: "Matrix has no dimensions (columns). Add at least one dimension.",
    });
  }

  // Check for empty dimensions
  for (const dim of matrix.dimensions) {
    if (dim.enabled && dim.values.length === 0) {
      warnings.push(
        `Dimension "${dim.name}" is enabled but has no values. ` +
          `Steps referencing it will fail.`
      );
    }
  }

  // --- 3. Step validation ---
  const stepMap = new Map(config.steps.map((s) => [s.id, s]));
  const dimMap = new Map(matrix.dimensions.map((d) => [d.id, d]));
  // Also map by lower-case name
  for (const d of matrix.dimensions) {
    dimMap.set(d.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"), d);
  }

  for (const step of config.steps) {
    // Check dimension refs for pick/use_similar
    if (
      (step.type === "pick" || step.type === "use_similar") &&
      step.dimensionRef
    ) {
      if (!dimMap.has(step.dimensionRef)) {
        errors.push({
          code: "INVALID_DIMENSION_REF",
          message:
            `Step "${step.label}" references dimension "${step.dimensionRef}" ` +
            `which does not exist in the matrix.`,
          stepId: step.id,
          dimensionId: step.dimensionRef,
        });
      }
    }

    // Check step refs for ref type
    if (step.type === "ref" && step.stepRefs) {
      for (const ref of step.stepRefs) {
        if (!stepMap.has(ref)) {
          errors.push({
            code: "INVALID_STEP_REF",
            message:
              `Step "${step.label}" references step "${ref}" which does not exist.`,
            stepId: step.id,
          });
        }
      }
    }

    // Check template step refs ({step_<id>})
    if (step.template) {
      const templateRefs = extractStepRefs(step.template);
      for (const ref of templateRefs) {
        if (!stepMap.has(ref)) {
          errors.push({
            code: "INVALID_TEMPLATE_STEP_REF",
            message:
              `Step "${step.label}" template references {step_${ref}} ` +
              `which does not exist.`,
            stepId: step.id,
          });
        }
      }
    }

    // Check for generative step without instruction
    if (step.type === "generative") {
      if (!step.generativeInstruction && !step.template) {
        errors.push({
          code: "MISSING_GENERATIVE_INSTRUCTION",
          message:
            `Generative step "${step.label}" has no instruction or template.`,
          stepId: step.id,
        });
      }
    }

    // Check for constraint step without constraints
    if (step.type === "constraint") {
      if (!step.constraints || step.constraints.length === 0) {
        warnings.push(
          `Constraint step "${step.label}" has no constraints defined. ` +
            `It will just resolve its template.`
        );
      }
    }

    // Check pick/use_similar without dimensionRef
    if (
      (step.type === "pick" || step.type === "use_similar") &&
      !step.dimensionRef
    ) {
      errors.push({
        code: "MISSING_DIMENSION_REF",
        message:
          `Step "${step.label}" (type: ${step.type}) requires a dimensionRef.`,
        stepId: step.id,
      });
    }
  }

  // --- 4. Cycle detection ---
  try {
    buildDependencyGraph(config.steps);
  } catch (err: any) {
    errors.push({
      code: "CIRCULAR_DEPENDENCY",
      message: err.message,
    });
  }

  // --- 5. Mode-specific validation ---
  if (config.mode === "sequence") {
    if (!config.sequenceSettings) {
      errors.push({
        code: "MISSING_SEQUENCE_SETTINGS",
        message:
          "Config is in sequence mode but has no sequenceSettings.",
      });
    } else {
      if (!config.sequenceSettings.characterStepId) {
        errors.push({
          code: "MISSING_CHARACTER_STEP",
          message:
            "Sequence mode requires a characterStepId.",
        });
      } else if (!stepMap.has(config.sequenceSettings.characterStepId)) {
        errors.push({
          code: "INVALID_CHARACTER_STEP",
          message:
            `Character step "${config.sequenceSettings.characterStepId}" ` +
            `does not exist in the config.`,
        });
      }

      if (
        config.sequenceSettings.totalScenes !==
        config.sequenceSettings.stateProgression?.length
      ) {
        errors.push({
          code: "SCENE_COUNT_MISMATCH",
          message:
            `totalScenes (${config.sequenceSettings.totalScenes}) does not match ` +
            `stateProgression length (${config.sequenceSettings.stateProgression?.length ?? 0}).`,
        });
      }
    }
  }

  if (config.mode === "batch") {
    if (!config.batchSettings) {
      errors.push({
        code: "MISSING_BATCH_SETTINGS",
        message: "Config is in batch mode but has no batchSettings.",
      });
    } else {
      if (config.batchSettings.totalCount <= 0) {
        errors.push({
          code: "INVALID_BATCH_COUNT",
          message: "Batch totalCount must be greater than 0.",
        });
      }
      if (config.batchSettings.batchSize <= 0) {
        errors.push({
          code: "INVALID_BATCH_SIZE",
          message: "Batch batchSize must be greater than 0.",
        });
      }
    }
  }

  // --- 6. Output settings validation ---
  if (
    config.outputSettings.outputSchema &&
    config.outputSettings.outputSchema.length > 0
  ) {
    for (const col of config.outputSettings.outputSchema) {
      if (col.sourceStepId && !stepMap.has(col.sourceStepId)) {
        errors.push({
          code: "INVALID_OUTPUT_COLUMN_STEP",
          message:
            `Output column "${col.name}" references step "${col.sourceStepId}" ` +
            `which does not exist.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick validation check — throws if invalid.
 */
export function assertConfigValid(
  config: PromptConfig,
  matrix: Matrix
): void {
  const result = validateConfig(config, matrix);
  if (!result.valid) {
    const errorMessages = result.errors
      .map((e) => `[${e.code}] ${e.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${errorMessages}`);
  }
}
