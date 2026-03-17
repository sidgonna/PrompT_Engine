// ============================================================================
// Master Prompter — Core Data Schema
// All TypeScript interfaces that define the data model
// ============================================================================

// ---------------------------------------------------------------------------
// Dimension & Matrix (the spreadsheet data plane)
// ---------------------------------------------------------------------------

export interface DimensionValue {
  id: string;
  value: string;
  weight?: number;           // optional bias for random selection (default 1)
  synonyms?: string[];       // inline synonyms for "use_similar" steps
}

export interface SynonymPool {
  id: string;
  name: string;              // "synonyms1", "synonyms2"
  entries: string[];
}

export type SelectionMode = "random" | "range" | "fixed" | "sequential";

export interface Dimension {
  id: string;
  name: string;              // "Emotions", "People", "Quirks"
  enabled: boolean;          // Y/N toggle from config
  selectionMode: SelectionMode;
  fixedValue?: string;       // used when selectionMode = "fixed"
  rangeMin?: number;         // used when selectionMode = "range"
  rangeMax?: number;
  values: DimensionValue[];
  synonymPools?: SynonymPool[];
  metadata?: Record<string, any>;
}

export interface Matrix {
  id: string;
  name: string;              // "Health Prompts Matrix"
  dimensions: Dimension[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Steps (the config/instruction data plane)
// ---------------------------------------------------------------------------

export type StepType = "pick" | "use_similar" | "ref" | "generative" | "constraint";

export interface Constraint {
  field: string;             // e.g. "difficulty_level"
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in";
  value: any;
}

export interface Step {
  id: string;
  order: number;             // execution hint (overridden by dep graph)
  enabled: boolean;
  type: StepType;
  label: string;             // human-readable, e.g. "Define the character"
  template: string;          // instruction text with <variable> placeholders

  // --- type-specific fields ---

  // pick / use_similar
  dimensionRef?: string;     // dimension.id to pick from
  pickCount?: number;        // how many values to pick (default 1)

  // ref
  stepRefs?: string[];       // step.id(s) this step depends on

  // generative
  generativeInstruction?: string; // e.g. "Write a short impactful Q&A"

  // constraint
  constraints?: Constraint[];

  // output mapping (for multi-column output like math/finance)
  outputColumn?: string;     // which output column this step feeds
}

// ---------------------------------------------------------------------------
// Config (the full step-sequence + settings)
// ---------------------------------------------------------------------------

export type PromptMode = "single" | "sequence" | "batch";

export interface StateProgressionEntry {
  sceneIndex: number;        // 0-based
  stateDelta: string;        // e.g. "still slightly overweight"
  overrides?: Record<string, string>; // dimension overrides for this scene
}

export interface SequenceSettings {
  characterLock: boolean;
  characterStepId: string;   // which step defines the character
  totalScenes: number;
  stateProgression: StateProgressionEntry[];
}

export interface BatchSettings {
  totalCount: number;        // e.g. 100 prompts
  batchSize: number;         // e.g. 10 per batch
}

export type OutputType =
  | "text"
  | "formatted_text"
  | "image"
  | "image_with_content"
  | "seq_image"
  | "seq_text"
  | "video"
  | "audio"
  | "presentation";

export interface OutputColumn {
  name: string;              // "Question", "Option A", "Answer Key"
  sourceStepId?: string;     // which step feeds this column
  isGenerated?: boolean;     // true for generative columns
}

export interface OutputSettings {
  outputType: OutputType[];
  wordCount?: { min: number; max: number } | number;
  format?: string;           // "vertical", "widescreen", "mobile"
  tone?: string;             // "funny", "scientific", "motivational"
  contentType?: string;      // "bullets", "paragraphs"
  outputSchema?: OutputColumn[]; // for multi-column outputs

  // image-specific
  cameraModel?: string;
  composition?: string;
  lighting?: string;

  // csv / export
  csvSanitize?: boolean;
  fewShotExamples?: string[];
}

export interface PromptConfig {
  id: string;
  name: string;
  matrixId: string;
  templateId?: string;

  mode: PromptMode;
  sequenceSettings?: SequenceSettings;
  batchSettings?: BatchSettings;

  steps: Step[];
  outputSettings: OutputSettings;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Domain Templates (reusable skeletons)
// ---------------------------------------------------------------------------

export interface DomainConfig {
  domainName: string;        // "Finance", "Health", "Career"
  matrixId: string;
  dimensionMappings: Record<string, string>; // skeleton var → dimension.id
}

export interface DomainTemplate {
  id: string;
  name: string;
  description: string;
  stepSkeleton: Step[];
  outputSchema: OutputColumn[];
  domains: DomainConfig[];
}

// ---------------------------------------------------------------------------
// Session & Execution Results (history / Phase 2)
// ---------------------------------------------------------------------------

export interface GeneratedOutput {
  index: number;                        // 0 for single, 0..N-1 for seq/batch
  prompt: string;
  context?: string;                     // intermediate variable steps
  outputColumns?: Record<string, string>; // for multi-column output
  sceneLabel?: string;                  // for sequence mode
}

export interface ExecutionResult {
  resolvedValues: Record<string, string>; // stepId → resolved value
  outputs: GeneratedOutput[];
  metadata: {
    totalTime: number;
    stepsExecuted: number;
    stepsSkipped: number;
    warnings: string[];
  };
}

export interface Session {
  id: string;
  userId?: string;           // null in Phase 1
  configId: string;
  matrixId: string;
  executionResult: ExecutionResult;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Validation & Error types
// ---------------------------------------------------------------------------

export interface ValidationError {
  code: string;
  message: string;
  stepId?: string;
  dimensionId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}
