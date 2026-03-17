// ============================================================================
// Master Prompter — Engine Test Suite
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { v4 as uuid } from "uuid";
import { Matrix, Dimension, Step, PromptConfig, DimensionValue } from "../src/models/schema";
import { buildDependencyGraph, topologicalSort } from "../src/engine/dependency";
import { executeSteps } from "../src/engine/resolver";
import { assemble } from "../src/engine/assembler";
import { validateConfig } from "../src/engine/validator";
import { exportResult } from "../src/engine/exporter";
import { extractVariables, extractStepRefs, substituteAll } from "../src/utils/variable-parser";
import { resolveSelection, resetSequentialCounters } from "../src/utils/random";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function createDimension(
  name: string,
  values: string[],
  overrides?: Partial<Dimension>
): Dimension {
  return {
    id: `dim_${name.toLowerCase()}`,
    name,
    enabled: true,
    selectionMode: "random",
    values: values.map((v) => ({
      id: `val_${v.toLowerCase().replace(/\s/g, "_")}`,
      value: v,
    })),
    ...overrides,
  };
}

function createStep(
  label: string,
  type: Step["type"],
  overrides?: Partial<Step>
): Step {
  return {
    id: `step_${label.toLowerCase().replace(/\s/g, "_")}`,
    order: 0,
    enabled: true,
    type,
    label,
    template: "",
    ...overrides,
  };
}

function createMatrix(dimensions: Dimension[]): Matrix {
  return {
    id: "matrix_test",
    name: "Test Matrix",
    dimensions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createConfig(
  steps: Step[],
  matrixId: string,
  overrides?: Partial<PromptConfig>
): PromptConfig {
  return {
    id: "config_test",
    name: "Test Config",
    matrixId,
    mode: "single",
    steps: steps.map((s, i) => ({ ...s, order: i })),
    outputSettings: { outputType: ["text"] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Variable Parser Tests
// ============================================================================

describe("Variable Parser", () => {
  it("extracts <variable> names from template", () => {
    const vars = extractVariables("Create a <person> in <place> with <emotion>");
    expect(vars).toEqual(["person", "place", "emotion"]);
  });

  it("extracts unique variables only", () => {
    const vars = extractVariables("<person> meets <person>");
    expect(vars).toEqual(["person"]);
  });

  it("extracts {step_id} references", () => {
    const refs = extractStepRefs("Combine {step_abc} with {step_xyz}");
    expect(refs).toEqual(["abc", "xyz"]);
  });

  it("substitutes variables and step refs", () => {
    const result = substituteAll(
      "A <emotion> <person> at {step_location}",
      { emotion: "happy", person: "woman" },
      { location: "beach" }
    );
    expect(result).toBe("A happy woman at beach");
  });

  it("leaves unresolved placeholders as-is", () => {
    const result = substituteAll("<known> and <unknown>", { known: "resolved" }, {});
    expect(result).toBe("resolved and <unknown>");
  });
});

// ============================================================================
// Random Selection Tests
// ============================================================================

describe("Random Selection", () => {
  beforeEach(() => {
    resetSequentialCounters();
  });

  it("fixed mode returns the configured value", () => {
    const dim = createDimension("Test", ["A", "B", "C"], {
      selectionMode: "fixed",
      fixedValue: "B",
    });
    expect(resolveSelection(dim)).toBe("B");
  });

  it("sequential mode cycles through values", () => {
    const dim = createDimension("Test", ["X", "Y", "Z"], {
      selectionMode: "sequential",
    });
    expect(resolveSelection(dim)).toBe("X");
    expect(resolveSelection(dim)).toBe("Y");
    expect(resolveSelection(dim)).toBe("Z");
    expect(resolveSelection(dim)).toBe("X"); // wraps around
  });

  it("random mode returns a value from the list", () => {
    const dim = createDimension("Test", ["A", "B", "C"]);
    const val = resolveSelection(dim);
    expect(["A", "B", "C"]).toContain(val);
  });

  it("range mode returns a value within bounds", () => {
    const dim = createDimension("Test", ["A", "B", "C", "D", "E"], {
      selectionMode: "range",
      rangeMin: 1,
      rangeMax: 3,
    });
    const val = resolveSelection(dim);
    expect(["B", "C", "D"]).toContain(val);
  });

  it("throws for empty dimension", () => {
    const dim = createDimension("Empty", [], { selectionMode: "random" });
    expect(() => resolveSelection(dim)).toThrow("has no values");
  });
});

// ============================================================================
// Dependency Graph Tests
// ============================================================================

describe("Dependency Graph", () => {
  it("builds a simple linear dependency chain", () => {
    const steps: Step[] = [
      createStep("Step A", "pick", { id: "a" }),
      createStep("Step B", "ref", { id: "b", stepRefs: ["a"] }),
      createStep("Step C", "ref", { id: "c", stepRefs: ["b"] }),
    ];

    const graph = buildDependencyGraph(steps);
    const sorted = topologicalSort(graph, steps);

    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
  });

  it("handles diamond dependencies", () => {
    const steps: Step[] = [
      createStep("A", "pick", { id: "a" }),
      createStep("B", "ref", { id: "b", stepRefs: ["a"] }),
      createStep("C", "ref", { id: "c", stepRefs: ["a"] }),
      createStep("D", "ref", { id: "d", stepRefs: ["b", "c"] }),
    ];

    const graph = buildDependencyGraph(steps);
    const sorted = topologicalSort(graph, steps);

    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("c"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("d"));
    expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("d"));
  });

  it("detects circular dependencies", () => {
    const steps: Step[] = [
      createStep("A", "ref", { id: "a", stepRefs: ["b"] }),
      createStep("B", "ref", { id: "b", stepRefs: ["a"] }),
    ];

    expect(() => buildDependencyGraph(steps)).toThrow("Circular dependency");
  });

  it("detects 3-node cycle", () => {
    const steps: Step[] = [
      createStep("A", "ref", { id: "a", stepRefs: ["c"] }),
      createStep("B", "ref", { id: "b", stepRefs: ["a"] }),
      createStep("C", "ref", { id: "c", stepRefs: ["b"] }),
    ];

    expect(() => buildDependencyGraph(steps)).toThrow("Circular dependency");
  });

  it("handles independent steps (no deps)", () => {
    const steps: Step[] = [
      createStep("A", "pick", { id: "a" }),
      createStep("B", "pick", { id: "b" }),
      createStep("C", "pick", { id: "c" }),
    ];

    const graph = buildDependencyGraph(steps);
    const sorted = topologicalSort(graph, steps);

    expect(sorted).toHaveLength(3);
    expect(sorted).toContain("a");
    expect(sorted).toContain("b");
    expect(sorted).toContain("c");
  });

  it("extracts deps from template {step_} refs", () => {
    const steps: Step[] = [
      createStep("A", "pick", { id: "a" }),
      createStep("B", "ref", {
        id: "b",
        template: "Use {step_a} to do something",
      }),
    ];

    const graph = buildDependencyGraph(steps);
    const sorted = topologicalSort(graph, steps);

    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
  });
});

// ============================================================================
// Step Resolver Tests
// ============================================================================

describe("Step Resolver", () => {
  let matrix: Matrix;
  let emotionDim: Dimension;
  let personDim: Dimension;

  beforeEach(() => {
    resetSequentialCounters();
    emotionDim = createDimension("Emotions", ["Happy", "Sad", "Angry"], {
      selectionMode: "fixed",
      fixedValue: "Happy",
    });
    personDim = createDimension("People", ["Man", "Woman", "Child"], {
      selectionMode: "fixed",
      fixedValue: "Woman",
    });
    matrix = createMatrix([emotionDim, personDim]);
  });

  it("resolves a pick step", () => {
    const steps = [
      createStep("Pick Emotion", "pick", {
        dimensionRef: "dim_emotions",
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.resolved[steps[0].id]).toBe("Happy");
    expect(ctx.stepsExecuted).toBe(1);
  });

  it("resolves a use_similar step", () => {
    const steps = [
      createStep("Similar Emotion", "use_similar", {
        dimensionRef: "dim_emotions",
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.resolved[steps[0].id]).toContain("Happy");
    expect(ctx.resolved[steps[0].id]).toContain("similar");
  });

  it("resolves a ref step pulling from earlier steps", () => {
    const steps = [
      createStep("Pick Emotion", "pick", {
        id: "s1",
        dimensionRef: "dim_emotions",
      }),
      createStep("Pick Person", "pick", {
        id: "s2",
        dimensionRef: "dim_people",
      }),
      createStep("Combine", "ref", {
        id: "s3",
        stepRefs: ["s1", "s2"],
        template: "A {step_s1} {step_s2} at the park",
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.resolved["s3"]).toBe("A Happy Woman at the park");
  });

  it("resolves a generative step", () => {
    const steps = [
      createStep("Generate QA", "generative", {
        generativeInstruction:
          "Write a short, impactful question and answer about health",
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.resolved[steps[0].id]).toBe(
      "Write a short, impactful question and answer about health"
    );
  });

  it("skips disabled steps gracefully", () => {
    const steps = [
      createStep("Pick Emotion", "pick", {
        id: "s1",
        dimensionRef: "dim_emotions",
        enabled: false,
      }),
      createStep("Ref Step", "ref", {
        id: "s2",
        stepRefs: ["s1"],
        template: "Emotion is {step_s1}",
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.skipped.has("s1")).toBe(true);
    expect(ctx.skipped.has("s2")).toBe(true); // cascade skip
    expect(ctx.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("skips steps when dimension is disabled", () => {
    emotionDim.enabled = false;
    matrix = createMatrix([emotionDim, personDim]);

    const steps = [
      createStep("Pick Emotion", "pick", {
        id: "s1",
        dimensionRef: "dim_emotions",
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.skipped.has("s1")).toBe(true);
  });

  it("resolves constraint step with passing constraint", () => {
    const steps = [
      createStep("Pick Emotion", "pick", {
        id: "s1",
        dimensionRef: "dim_emotions",
      }),
      createStep("Check Valid", "constraint", {
        id: "s2",
        stepRefs: ["s1"],
        template: "Validated: {step_s1}",
        constraints: [{ field: "s1", operator: "eq", value: "Happy" }],
      }),
    ];
    const config = createConfig(steps, matrix.id);
    const ctx = executeSteps(config, matrix);

    expect(ctx.resolved["s2"]).toBe("Validated: Happy");
  });
});

// ============================================================================
// Assembler Tests
// ============================================================================

describe("Assembler", () => {
  let matrix: Matrix;

  beforeEach(() => {
    resetSequentialCounters();
    matrix = createMatrix([
      createDimension("Emotions", ["Happy"], {
        selectionMode: "fixed",
        fixedValue: "Happy",
      }),
      createDimension("People", ["Woman"], {
        selectionMode: "fixed",
        fixedValue: "Woman",
      }),
    ]);
  });

  it("assembles single mode prompt", () => {
    const steps = [
      createStep("Emotion", "pick", { dimensionRef: "dim_emotions" }),
      createStep("Person", "pick", { dimensionRef: "dim_people" }),
    ];
    const config = createConfig(steps, matrix.id);
    const result = assemble(config, matrix);

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].index).toBe(0);
    expect(result.outputs[0].prompt).toBeTruthy();
    expect(result.metadata.stepsExecuted).toBe(2);
  });

  it("assembles sequence mode with 3 scenes", () => {
    const charStep = createStep("Character", "pick", {
      id: "char",
      dimensionRef: "dim_people",
    });
    const emotionStep = createStep("Emotion", "pick", {
      id: "emo",
      dimensionRef: "dim_emotions",
    });

    const config = createConfig([charStep, emotionStep], matrix.id, {
      mode: "sequence",
      sequenceSettings: {
        characterLock: true,
        characterStepId: "char",
        totalScenes: 3,
        stateProgression: [
          { sceneIndex: 0, stateDelta: "Obese, upset" },
          { sceneIndex: 1, stateDelta: "Less obese, neutral" },
          { sceneIndex: 2, stateDelta: "Lean, happy" },
        ],
      },
    });

    const result = assemble(config, matrix);

    expect(result.outputs).toHaveLength(3);
    expect(result.outputs[0].sceneLabel).toBe("Obese, upset");
    expect(result.outputs[1].sceneLabel).toBe("Less obese, neutral");
    expect(result.outputs[2].sceneLabel).toBe("Lean, happy");

    // All scenes should mention the same character
    for (const output of result.outputs) {
      expect(output.prompt).toContain("Woman");
    }
  });

  it("assembles batch mode with re-rolled randoms", () => {
    matrix = createMatrix([
      createDimension("Emotions", ["Happy", "Sad", "Angry"]),
    ]);

    const steps = [
      createStep("Emotion", "pick", { dimensionRef: "dim_emotions" }),
    ];
    const config = createConfig(steps, matrix.id, {
      mode: "batch",
      batchSettings: { totalCount: 5, batchSize: 5 },
    });

    const result = assemble(config, matrix);
    expect(result.outputs).toHaveLength(5);
  });

  it("assembles multi-column output", () => {
    const steps = [
      createStep("Question", "generative", {
        id: "q",
        generativeInstruction: "Generate a math question",
        outputColumn: "Question",
      }),
      createStep("Answer", "generative", {
        id: "a",
        generativeInstruction: "Provide the answer",
        outputColumn: "Answer",
      }),
    ];

    const config = createConfig(steps, matrix.id, {
      outputSettings: {
        outputType: ["text"],
        outputSchema: [
          { name: "Question", sourceStepId: "q" },
          { name: "Answer", sourceStepId: "a" },
        ],
      },
    });

    const result = assemble(config, matrix);
    expect(result.outputs[0].outputColumns).toBeDefined();
    expect(result.outputs[0].outputColumns!["Question"]).toBeTruthy();
    expect(result.outputs[0].outputColumns!["Answer"]).toBeTruthy();
  });
});

// ============================================================================
// Validator Tests
// ============================================================================

describe("Validator", () => {
  it("passes a valid config", () => {
    const matrix = createMatrix([
      createDimension("Emotions", ["Happy", "Sad"]),
    ]);
    const steps = [
      createStep("Pick", "pick", { dimensionRef: "dim_emotions" }),
    ];
    const config = createConfig(steps, matrix.id);

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails on empty steps", () => {
    const matrix = createMatrix([]);
    const config = createConfig([], matrix.id);

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "NO_STEPS")).toBe(true);
  });

  it("fails on invalid dimension ref", () => {
    const matrix = createMatrix([
      createDimension("Emotions", ["Happy"]),
    ]);
    const steps = [
      createStep("Pick", "pick", { dimensionRef: "nonexistent" }),
    ];
    const config = createConfig(steps, matrix.id);

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "INVALID_DIMENSION_REF")
    ).toBe(true);
  });

  it("fails on circular dependencies", () => {
    const matrix = createMatrix([]);
    const steps = [
      createStep("A", "ref", { id: "a", stepRefs: ["b"] }),
      createStep("B", "ref", { id: "b", stepRefs: ["a"] }),
    ];
    const config = createConfig(steps, matrix.id);

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "CIRCULAR_DEPENDENCY")
    ).toBe(true);
  });

  it("fails on sequence mode without settings", () => {
    const matrix = createMatrix([]);
    const steps = [createStep("A", "pick")];
    const config = createConfig(steps, matrix.id, { mode: "sequence" });

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "MISSING_SEQUENCE_SETTINGS")
    ).toBe(true);
  });

  it("fails on batch mode with totalCount 0", () => {
    const matrix = createMatrix([]);
    const steps = [createStep("A", "pick")];
    const config = createConfig(steps, matrix.id, {
      mode: "batch",
      batchSettings: { totalCount: 0, batchSize: 10 },
    });

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "INVALID_BATCH_COUNT")
    ).toBe(true);
  });

  it("fails on generative step without instruction", () => {
    const matrix = createMatrix([]);
    const steps = [
      createStep("Gen", "generative", {
        generativeInstruction: undefined,
        template: "",
      }),
    ];
    const config = createConfig(steps, matrix.id);

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "MISSING_GENERATIVE_INSTRUCTION")
    ).toBe(true);
  });

  it("warns on empty enabled dimension", () => {
    const matrix = createMatrix([
      createDimension("Empty", [], { enabled: true }),
    ]);
    const steps = [createStep("A", "pick")];
    const config = createConfig(steps, matrix.id);

    const result = validateConfig(config, matrix);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("no values");
  });

  it("validates output schema step refs", () => {
    const matrix = createMatrix([]);
    const steps = [createStep("A", "generative", { id: "real_step", generativeInstruction: "test" })];
    const config = createConfig(steps, matrix.id, {
      outputSettings: {
        outputType: ["text"],
        outputSchema: [
          { name: "Col1", sourceStepId: "nonexistent_step" },
        ],
      },
    });

    const result = validateConfig(config, matrix);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "INVALID_OUTPUT_COLUMN_STEP")
    ).toBe(true);
  });
});

// ============================================================================
// Exporter Tests
// ============================================================================

describe("Exporter", () => {
  const mockResult = {
    resolvedValues: { s1: "Happy", s2: "Woman" },
    outputs: [{ index: 0, prompt: "A happy woman at the park" }],
    metadata: {
      totalTime: 5,
      stepsExecuted: 2,
      stepsSkipped: 0,
      warnings: [],
    },
  };

  const mockConfig = createConfig([], "matrix_test");

  it("exports to TXT", () => {
    const txt = exportResult(mockResult, mockConfig, { format: "txt" });
    expect(txt).toContain("A happy woman at the park");
    expect(txt).toContain("Test Config");
  });

  it("exports to TXT with metadata", () => {
    const txt = exportResult(mockResult, mockConfig, {
      format: "txt",
      includeMetadata: true,
    });
    expect(txt).toContain("Execution time: 5ms");
    expect(txt).toContain("Steps executed: 2");
  });

  it("exports to JSON", () => {
    const json = exportResult(mockResult, mockConfig, { format: "json" });
    const parsed = JSON.parse(json);
    expect(parsed.outputs[0].prompt).toBe("A happy woman at the park");
    expect(parsed.config.name).toBe("Test Config");
  });

  it("exports to CSV", () => {
    const csv = exportResult(mockResult, mockConfig, { format: "csv" });
    expect(csv).toContain("Index");
    expect(csv).toContain("Prompt");
  });

  it("exports multi-column to CSV", () => {
    const multiResult = {
      ...mockResult,
      outputs: [
        {
          index: 0,
          prompt: "Q: What? A: Yes",
          outputColumns: { Question: "What?", Answer: "Yes" },
        },
      ],
    };
    const csv = exportResult(multiResult, mockConfig, { format: "csv" });
    expect(csv).toContain("Question");
    expect(csv).toContain("Answer");
    expect(csv).toContain("What?");
    expect(csv).toContain("Yes");
  });
});
