// ============================================================================
// Exporter — format and export generated outputs to TXT, JSON, CSV
// ============================================================================

import { ExecutionResult, GeneratedOutput, PromptConfig } from "../models/schema";

export type ExportFormat = "txt" | "json" | "csv";

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  csvDelimiter?: string;
  csvSanitize?: boolean;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Export execution results to the specified format.
 * Returns the formatted string content.
 */
export function exportResult(
  result: ExecutionResult,
  config: PromptConfig,
  options: ExportOptions
): string {
  switch (options.format) {
    case "txt":
      return exportToTxt(result, config, options);
    case "json":
      return exportToJson(result, config, options);
    case "csv":
      return exportToCsv(result, config, options);
    default:
      throw new Error(`Unknown export format: "${options.format}"`);
  }
}

// ---------------------------------------------------------------------------
// TXT export
// ---------------------------------------------------------------------------

function exportToTxt(
  result: ExecutionResult,
  config: PromptConfig,
  options: ExportOptions
): string {
  const lines: string[] = [];

  // Header
  lines.push(`==================================================`);
  lines.push(`Config: ${config.name}`);
  lines.push(`Mode: ${config.mode}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total outputs: ${result.outputs.length}`);
  lines.push(`==================================================`);
  lines.push("");

  // Outputs
  for (const output of result.outputs) {
    if (result.outputs.length > 1) {
      lines.push(`--- Output ${output.index + 1} ---`);
      if (output.sceneLabel) {
        lines.push(`Scene: ${output.sceneLabel}`);
      }
      lines.push("");
    }

    lines.push(output.prompt);
    lines.push("");

    if (output.outputColumns) {
      lines.push("Structured Output:");
      for (const [col, val] of Object.entries(output.outputColumns)) {
        lines.push(`  ${col}: ${val}`);
      }
      lines.push("");
    }
  }

  // Metadata
  if (options.includeMetadata) {
    lines.push("==================================================");
    lines.push("Metadata:");
    lines.push(`  Execution time: ${result.metadata.totalTime}ms`);
    lines.push(`  Steps executed: ${result.metadata.stepsExecuted}`);
    lines.push(`  Steps skipped: ${result.metadata.stepsSkipped}`);
    if (result.metadata.warnings.length > 0) {
      lines.push("  Warnings:");
      for (const w of result.metadata.warnings) {
        lines.push(`    - ${w}`);
      }
    }
    lines.push("==================================================");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

function exportToJson(
  result: ExecutionResult,
  config: PromptConfig,
  options: ExportOptions
): string {
  const exportData: any = {
    config: {
      id: config.id,
      name: config.name,
      mode: config.mode,
    },
    generated: new Date().toISOString(),
    outputs: result.outputs.map((o) => ({
      index: o.index,
      prompt: o.prompt,
      ...(o.sceneLabel ? { sceneLabel: o.sceneLabel } : {}),
      ...(o.outputColumns ? { columns: o.outputColumns } : {}),
    })),
  };

  if (options.includeMetadata) {
    exportData.metadata = result.metadata;
    exportData.resolvedValues = result.resolvedValues;
  }

  return JSON.stringify(exportData, null, 2);
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportToCsv(
  result: ExecutionResult,
  config: PromptConfig,
  options: ExportOptions
): string {
  const delimiter = options.csvDelimiter ?? ",";
  const sanitize = options.csvSanitize ?? true;
  const lines: string[] = [];

  // Determine columns
  const hasMultiColumn = result.outputs.some((o) => o.outputColumns);

  if (hasMultiColumn) {
    // Multi-column mode: use output schema columns
    const firstWithCols = result.outputs.find((o) => o.outputColumns);
    if (firstWithCols?.outputColumns) {
      const headers = Object.keys(firstWithCols.outputColumns);
      lines.push(headers.map((h) => csvEscape(h, delimiter, sanitize)).join(delimiter));

      for (const output of result.outputs) {
        const row = headers.map((h) =>
          csvEscape(output.outputColumns?.[h] ?? "", delimiter, sanitize)
        );
        lines.push(row.join(delimiter));
      }
    }
  } else {
    // Single prompt mode: Index, Prompt, SceneLabel (if sequence)
    const isSequence = result.outputs.some((o) => o.sceneLabel);
    const headers = isSequence
      ? ["Index", "Scene", "Prompt"]
      : ["Index", "Prompt"];

    lines.push(headers.map((h) => csvEscape(h, delimiter, sanitize)).join(delimiter));

    for (const output of result.outputs) {
      const row: string[] = [String(output.index + 1)];
      if (isSequence) {
        row.push(csvEscape(output.sceneLabel ?? "", delimiter, sanitize));
      }
      row.push(csvEscape(output.prompt, delimiter, sanitize));
      lines.push(row.join(delimiter));
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/**
 * Escape a value for CSV output.
 * Handles: quotes, delimiters, newlines, formula injection.
 */
function csvEscape(
  value: string,
  delimiter: string,
  sanitize: boolean
): string {
  let escaped = value;

  // Sanitize against CSV injection (formula injection)
  if (sanitize) {
    const dangerousChars = ["=", "+", "-", "@", "\t", "\r"];
    if (dangerousChars.some((c) => escaped.startsWith(c))) {
      escaped = "'" + escaped; // prefix with single quote
    }
  }

  // Wrap in quotes if contains delimiter, quotes, or newlines
  if (
    escaped.includes(delimiter) ||
    escaped.includes('"') ||
    escaped.includes("\n") ||
    escaped.includes("\r")
  ) {
    escaped = '"' + escaped.replace(/"/g, '""') + '"';
  }

  return escaped;
}
