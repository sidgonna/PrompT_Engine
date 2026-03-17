// ============================================================================
// Engine Routes — Execute, preview, validate, export
// ============================================================================

import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { IStorage } from "../storage/storage.interface";
import { Session } from "../models/schema";
import { assemble } from "../engine/assembler";
import { validateConfig } from "../engine/validator";
import { exportResult, ExportFormat } from "../engine/exporter";

export function createEngineRouter(storage: IStorage): Router {
  const router = Router();

  // POST /api/engine/validate — Validate config + matrix
  router.post("/validate", async (req: Request, res: Response) => {
    try {
      const { configId } = req.body;

      if (!configId) {
        return res.status(400).json({ error: "configId is required." });
      }

      const config = await storage.getConfig(configId);
      if (!config) {
        return res.status(404).json({ error: "Config not found." });
      }

      const matrix = await storage.getMatrix(config.matrixId);
      if (!matrix) {
        return res.status(404).json({ error: "Linked matrix not found." });
      }

      const result = validateConfig(config, matrix);
      res.json({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/engine/preview — Dry-run: validate + resolve steps (no save)
  router.post("/preview", async (req: Request, res: Response) => {
    try {
      const { configId } = req.body;

      if (!configId) {
        return res.status(400).json({ error: "configId is required." });
      }

      const config = await storage.getConfig(configId);
      if (!config) {
        return res.status(404).json({ error: "Config not found." });
      }

      const matrix = await storage.getMatrix(config.matrixId);
      if (!matrix) {
        return res.status(404).json({ error: "Linked matrix not found." });
      }

      // Validate first
      const validation = validateConfig(config, matrix);
      if (!validation.valid) {
        return res.status(422).json({
          error: "Config validation failed.",
          validation,
        });
      }

      // Execute
      const result = assemble(config, matrix);

      res.json({
        data: result,
        warnings: validation.warnings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/engine/execute — Full execution + save to session history
  router.post("/execute", async (req: Request, res: Response) => {
    try {
      const { configId, userId } = req.body;

      if (!configId) {
        return res.status(400).json({ error: "configId is required." });
      }

      const config = await storage.getConfig(configId);
      if (!config) {
        return res.status(404).json({ error: "Config not found." });
      }

      const matrix = await storage.getMatrix(config.matrixId);
      if (!matrix) {
        return res.status(404).json({ error: "Linked matrix not found." });
      }

      // Validate first
      const validation = validateConfig(config, matrix);
      if (!validation.valid) {
        return res.status(422).json({
          error: "Config validation failed.",
          validation,
        });
      }

      // Execute
      const result = assemble(config, matrix);

      // Save session
      const session: Session = {
        id: uuid(),
        userId: userId ?? undefined,
        configId: config.id,
        matrixId: matrix.id,
        executionResult: result,
        createdAt: new Date().toISOString(),
      };

      await storage.saveSession(session);

      res.json({
        data: result,
        sessionId: session.id,
        warnings: validation.warnings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/engine/export — Execute + export to format
  router.post("/export", async (req: Request, res: Response) => {
    try {
      const {
        configId,
        format = "txt",
        includeMetadata = false,
        csvDelimiter,
        csvSanitize,
      } = req.body;

      if (!configId) {
        return res.status(400).json({ error: "configId is required." });
      }

      const config = await storage.getConfig(configId);
      if (!config) {
        return res.status(404).json({ error: "Config not found." });
      }

      const matrix = await storage.getMatrix(config.matrixId);
      if (!matrix) {
        return res.status(404).json({ error: "Linked matrix not found." });
      }

      // Validate
      const validation = validateConfig(config, matrix);
      if (!validation.valid) {
        return res.status(422).json({
          error: "Config validation failed.",
          validation,
        });
      }

      // Execute
      const result = assemble(config, matrix);

      // Export
      const exported = exportResult(result, config, {
        format: format as ExportFormat,
        includeMetadata,
        csvDelimiter,
        csvSanitize: csvSanitize ?? config.outputSettings.csvSanitize,
      });

      // Set appropriate content type
      const contentTypeMap: Record<string, string> = {
        txt: "text/plain",
        json: "application/json",
        csv: "text/csv",
      };

      const contentType = contentTypeMap[format] ?? "text/plain";
      const ext = format;
      const filename = `${config.name.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.${ext}`;

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(exported);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
