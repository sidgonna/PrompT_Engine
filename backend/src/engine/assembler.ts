// ============================================================================
// Assembler — combines resolved step values into final prompt outputs
// Handles: single mode, sequence mode, batch mode, multi-column output
// ============================================================================

import {
  PromptConfig,
  Matrix,
  GeneratedOutput,
  ExecutionResult,
} from "../models/schema";
import {
  executeSteps,
  ResolutionContext,
} from "./resolver";
import { substituteAll } from "../utils/variable-parser";
import { resetSequentialCounters } from "../utils/random";

// ---------------------------------------------------------------------------
// Main assembler entry point
// ---------------------------------------------------------------------------

/**
 * Execute the full pipeline: resolve steps → assemble output(s).
 * Returns a complete ExecutionResult with all outputs + metadata.
 */
export function assemble(
  config: PromptConfig,
  matrix: Matrix
): ExecutionResult {
  const startTime = Date.now();

  let outputs: GeneratedOutput[];
  let ctx: ResolutionContext;

  switch (config.mode) {
    case "single":
      ({ outputs, ctx } = assembleSingle(config, matrix));
      break;

    case "sequence":
      ({ outputs, ctx } = assembleSequence(config, matrix));
      break;

    case "batch":
      ({ outputs, ctx } = assembleBatch(config, matrix));
      break;

    default:
      throw new Error(`Unknown config mode: "${config.mode}"`);
  }

  const totalTime = Date.now() - startTime;

  return {
    resolvedValues: ctx.resolved,
    outputs,
    metadata: {
      totalTime,
      stepsExecuted: ctx.stepsExecuted,
      stepsSkipped: ctx.skipped.size,
      warnings: ctx.warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Single mode — one assembled prompt from all resolved steps
// ---------------------------------------------------------------------------

function assembleSingle(
  config: PromptConfig,
  matrix: Matrix
): { outputs: GeneratedOutput[]; ctx: ResolutionContext } {
  const ctx = executeSteps(config, matrix, { resetSequentials: true });

  // Check if multi-column output
  if (
    config.outputSettings.outputSchema &&
    config.outputSettings.outputSchema.length > 0
  ) {
    const row = assembleMultiColumn(config, ctx);
    return {
      outputs: [
        {
          index: 0,
          prompt: formatMultiColumnRow(row),
          outputColumns: row,
        },
      ],
      ctx,
    };
  }

  // Standard single prompt
  const parts = assemblePromptParts(config, ctx);
  return {
    outputs: [{ index: 0, context: parts.context, prompt: parts.prompt }],
    ctx,
  };
}

// ---------------------------------------------------------------------------
// Sequence mode — N prompts with character lock + state progression
// ---------------------------------------------------------------------------

function assembleSequence(
  config: PromptConfig,
  matrix: Matrix
): { outputs: GeneratedOutput[]; ctx: ResolutionContext } {
  const seq = config.sequenceSettings;

  if (!seq) {
    throw new Error(
      `Config "${config.name}" is in sequence mode but has no sequenceSettings.`
    );
  }

  if (!seq.characterStepId) {
    throw new Error(
      `Sequence mode requires a characterStepId to lock the character across scenes.`
    );
  }

  // Execute steps once to get the character + base resolved values
  const baseCtx = executeSteps(config, matrix, { resetSequentials: true });

  if (baseCtx.skipped.has(seq.characterStepId)) {
    throw new Error(
      `Character step "${seq.characterStepId}" was skipped — cannot run sequence mode.`
    );
  }

  const characterDesc = baseCtx.resolved[seq.characterStepId];
  const outputs: GeneratedOutput[] = [];

  for (let i = 0; i < seq.totalScenes; i++) {
    const progression = seq.stateProgression[i];

    if (!progression) {
      throw new Error(
        `Missing state progression entry for scene ${i}. Expected ${seq.totalScenes} entries.`
      );
    }

    // Build per-scene resolved map: base values + scene overrides
    const sceneResolved = { ...baseCtx.resolved };

    if (progression.overrides) {
      for (const [key, value] of Object.entries(progression.overrides)) {
        sceneResolved[key] = value;
      }
    }

    // Build the scene context and prompt separately
    const contextParts: string[] = [];
    const promptParts: string[] = [];

    // 1. Character description (locked across scenes)
    contextParts.push(`Character: ${characterDesc}`);

    // 2. Current state in the progression
    contextParts.push(`Scene ${i + 1}/${seq.totalScenes}: ${progression.stateDelta}`);

    // 3. Assemble remaining steps (excluding character step)
    for (const step of config.steps) {
      if (step.id === seq.characterStepId) continue;
      if (baseCtx.skipped.has(step.id)) continue;

      const resolved = sceneResolved[step.id];
      if (resolved !== undefined) {
        if (step.type === "generative" || step.type === "ref") {
          promptParts.push(`${step.label}:\n${resolved}`);
        } else {
          contextParts.push(`${step.label}: ${resolved}`);
        }
      }
    }

    let scenePrompt = promptParts.join("\n\n");
    // If no generative steps, fallback to using all context as prompt
    if (!scenePrompt) {
      scenePrompt = contextParts.join("\n");
      contextParts.length = 0; // clear context
    }

    // 4. Apply output settings
    scenePrompt = applyOutputSettings(scenePrompt, config);

    outputs.push({
      index: i,
      context: contextParts.join("\n").trim(),
      prompt: scenePrompt.trim(),
      sceneLabel: progression.stateDelta,
    });
  }

  return { outputs, ctx: baseCtx };
}

// ---------------------------------------------------------------------------
// Batch mode — N independent prompts with re-rolled random picks
// ---------------------------------------------------------------------------

function assembleBatch(
  config: PromptConfig,
  matrix: Matrix
): { outputs: GeneratedOutput[]; ctx: ResolutionContext } {
  const batch = config.batchSettings;

  if (!batch) {
    throw new Error(
      `Config "${config.name}" is in batch mode but has no batchSettings.`
    );
  }

  const outputs: GeneratedOutput[] = [];
  let lastCtx: ResolutionContext | null = null;

  // Reset once at the beginning for sequential counters
  resetSequentialCounters();

  // Check if multi-column output
  const isMultiColumn =
    config.outputSettings.outputSchema &&
    config.outputSettings.outputSchema.length > 0;

  for (let i = 0; i < batch.totalCount; i++) {
    const ctx = executeSteps(config, matrix, {
      resetSequentials: false, // preserve sequential state across batch
    });

    if (isMultiColumn) {
      const row = assembleMultiColumn(config, ctx);
      outputs.push({
        index: i,
        prompt: formatMultiColumnRow(row),
        outputColumns: row,
      });
    } else {
      const parts = assemblePromptParts(config, ctx);
      outputs.push({ index: i, context: parts.context, prompt: parts.prompt });
    }

    lastCtx = ctx;
  }

  // Return the last context (aggregated warnings might be useful)
  return {
    outputs,
    ctx: lastCtx ?? {
      resolved: {},
      skipped: new Set(),
      warnings: [],
      stepsExecuted: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Multi-column output assembly (math / finance templates)
// ---------------------------------------------------------------------------

function assembleMultiColumn(
  config: PromptConfig,
  ctx: ResolutionContext
): Record<string, string> {
  const schema = config.outputSettings.outputSchema;
  if (!schema) return {};

  const row: Record<string, string> = {};

  for (const col of schema) {
    if (col.sourceStepId) {
      if (ctx.skipped.has(col.sourceStepId)) {
        row[col.name] = "";
        ctx.warnings.push(
          `Output column "${col.name}" is empty — source step ` +
            `"${col.sourceStepId}" was skipped.`
        );
      } else {
        row[col.name] = ctx.resolved[col.sourceStepId] ?? "";
      }
    } else if (col.isGenerated) {
      row[col.name] = "[LLM will generate]";
    } else {
      row[col.name] = "";
    }
  }

  return row;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assemble separate context and prompt strings from all resolved steps.
 */
function assemblePromptParts(
  config: PromptConfig,
  ctx: ResolutionContext
): { context: string; prompt: string } {
  const contextParts: string[] = [];
  const promptParts: string[] = [];

  for (const step of config.steps) {
    if (ctx.skipped.has(step.id)) continue;

    const resolved = ctx.resolved[step.id];
    if (resolved !== undefined) {
      if (step.type === "generative" || step.type === "ref") {
        promptParts.push(`${step.label}:\n${resolved}`);
      } else {
        contextParts.push(`${step.label}: ${resolved}`);
      }
    }
  }

  let prompt = promptParts.join("\n\n");
  
  // Fallback: If no generative/ref steps exist, move context to prompt
  if (!prompt) {
    prompt = contextParts.join("\n");
    contextParts.length = 0;
  }
  
  prompt = applyOutputSettings(prompt, config);
  const context = contextParts.join("\n");
  
  return { context: context.trim(), prompt: prompt.trim() };
}

/**
 * Apply output settings (tone, word count, format instructions).
 */
function applyOutputSettings(prompt: string, config: PromptConfig): string {
  const settings = config.outputSettings;
  const additions: string[] = [];

  // Output type instruction
  if (settings.outputType && settings.outputType.length > 0) {
    additions.push(`Output type: ${settings.outputType.join(", ")}`);
  }

  // Tone
  if (settings.tone) {
    additions.push(`Tone: ${settings.tone}`);
  }

  // Word count
  if (settings.wordCount) {
    if (typeof settings.wordCount === "number") {
      additions.push(`Target word count: ${settings.wordCount} words`);
    } else {
      additions.push(
        `Word count: ${settings.wordCount.min}-${settings.wordCount.max} words`
      );
    }
  }

  // Format
  if (settings.format) {
    additions.push(`Format: ${settings.format}`);
  }

  // Content type
  if (settings.contentType) {
    additions.push(`Content type: ${settings.contentType}`);
  }

  // Image-specific
  if (settings.cameraModel) {
    additions.push(`Camera: ${settings.cameraModel}`);
  }
  if (settings.composition) {
    additions.push(`Composition: ${settings.composition}`);
  }
  if (settings.lighting) {
    additions.push(`Lighting: ${settings.lighting}`);
  }

  // Few-shot examples
  if (settings.fewShotExamples && settings.fewShotExamples.length > 0) {
    additions.push(
      `\n--- Examples ---\n${settings.fewShotExamples.join("\n---\n")}\n--- End Examples ---`
    );
  }

  if (additions.length > 0) {
    prompt += "\n\n--- Output Requirements ---\n" + additions.join("\n");
  }

  return prompt;
}

/**
 * Format a multi-column row as a readable string.
 */
function formatMultiColumnRow(row: Record<string, string>): string {
  return Object.entries(row)
    .map(([col, val]) => `${col}: ${val}`)
    .join("\n");
}
