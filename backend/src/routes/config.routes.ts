// ============================================================================
// Config Routes — CRUD for prompt configs and steps
// ============================================================================

import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { IStorage } from "../storage/storage.interface";
import { PromptConfig, Step } from "../models/schema";

export function createConfigRouter(storage: IStorage): Router {
  const router = Router();

  // GET /api/configs — List all configs
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const configs = await storage.getConfigs();
      // Return lightweight list (without full step details)
      const summary = configs.map((c) => ({
        id: c.id,
        name: c.name,
        mode: c.mode,
        matrixId: c.matrixId,
        templateId: c.templateId,
        stepCount: c.steps.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      res.json({ data: summary, count: summary.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/configs — Create a new config
  router.post("/", async (req: Request, res: Response) => {
    try {
      const body = req.body;

      if (!body.name) {
        return res.status(400).json({ error: "Config name is required." });
      }
      if (!body.matrixId) {
        return res
          .status(400)
          .json({ error: "matrixId is required." });
      }

      const config: PromptConfig = {
        id: uuid(),
        name: body.name,
        matrixId: body.matrixId,
        templateId: body.templateId,
        mode: body.mode ?? "single",
        sequenceSettings: body.sequenceSettings,
        batchSettings: body.batchSettings,
        steps: (body.steps ?? []).map((s: any, i: number) =>
          normalizeStep(s, i)
        ),
        outputSettings: body.outputSettings ?? {
          outputType: ["text"],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await storage.saveConfig(config);
      res.status(201).json({ data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/configs/:id — Get a full config
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const config = await storage.getConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Config not found." });
      }
      res.json({ data: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/configs/:id — Update a config
  router.put("/:id", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getConfig(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Config not found." });
      }

      const updated: PromptConfig = {
        ...existing,
        name: req.body.name ?? existing.name,
        matrixId: req.body.matrixId ?? existing.matrixId,
        templateId: req.body.templateId ?? existing.templateId,
        mode: req.body.mode ?? existing.mode,
        sequenceSettings:
          req.body.sequenceSettings ?? existing.sequenceSettings,
        batchSettings: req.body.batchSettings ?? existing.batchSettings,
        steps: req.body.steps
          ? req.body.steps.map((s: any, i: number) => normalizeStep(s, i))
          : existing.steps,
        outputSettings:
          req.body.outputSettings ?? existing.outputSettings,
        updatedAt: new Date().toISOString(),
      };

      const saved = await storage.saveConfig(updated);
      res.json({ data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/configs/:id — Delete a config
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getConfig(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Config not found." });
      }
      await storage.deleteConfig(req.params.id);
      res.json({ message: "Config deleted." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------------
  // Step-level operations
  // -----------------------------------------------------------------------

  // PATCH /api/configs/:id/steps/reorder — Reorder steps
  router.patch(
    "/:id/steps/reorder",
    async (req: Request, res: Response) => {
      try {
        const config = await storage.getConfig(req.params.id);
        if (!config) {
          return res.status(404).json({ error: "Config not found." });
        }

        const { stepOrder } = req.body; // array of step IDs in new order
        if (!Array.isArray(stepOrder)) {
          return res
            .status(400)
            .json({ error: "stepOrder must be an array of step IDs." });
        }

        const stepMap = new Map(config.steps.map((s) => [s.id, s]));
        const reordered: Step[] = [];

        for (let i = 0; i < stepOrder.length; i++) {
          const step = stepMap.get(stepOrder[i]);
          if (!step) {
            return res
              .status(400)
              .json({ error: `Step ID "${stepOrder[i]}" not found.` });
          }
          step.order = i;
          reordered.push(step);
        }

        // Add any steps not in the reorder list (append at end)
        for (const step of config.steps) {
          if (!stepOrder.includes(step.id)) {
            step.order = reordered.length;
            reordered.push(step);
          }
        }

        config.steps = reordered;
        config.updatedAt = new Date().toISOString();

        const saved = await storage.saveConfig(config);
        res.json({ data: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // PATCH /api/configs/:id/steps/:stepId/toggle — Toggle step enabled/disabled
  router.patch(
    "/:id/steps/:stepId/toggle",
    async (req: Request, res: Response) => {
      try {
        const config = await storage.getConfig(req.params.id);
        if (!config) {
          return res.status(404).json({ error: "Config not found." });
        }

        const step = config.steps.find(
          (s) => s.id === req.params.stepId
        );
        if (!step) {
          return res.status(404).json({ error: "Step not found." });
        }

        step.enabled =
          req.body.enabled !== undefined ? req.body.enabled : !step.enabled;
        config.updatedAt = new Date().toISOString();

        const saved = await storage.saveConfig(config);
        res.json({
          data: step,
          message: `Step "${step.label}" is now ${step.enabled ? "enabled" : "disabled"}.`,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // PATCH /api/configs/:id/dimensions/:dimId/toggle — Toggle dimension Y/N
  // (This modifies the matrix through the config's matrixId)
  router.patch(
    "/:id/dimensions/:dimId/toggle",
    async (req: Request, res: Response) => {
      try {
        const config = await storage.getConfig(req.params.id);
        if (!config) {
          return res.status(404).json({ error: "Config not found." });
        }

        const matrix = await storage.getMatrix(config.matrixId);
        if (!matrix) {
          return res.status(404).json({ error: "Linked matrix not found." });
        }

        const dim = matrix.dimensions.find(
          (d) => d.id === req.params.dimId
        );
        if (!dim) {
          return res.status(404).json({ error: "Dimension not found." });
        }

        dim.enabled =
          req.body.enabled !== undefined ? req.body.enabled : !dim.enabled;
        matrix.updatedAt = new Date().toISOString();

        await storage.saveMatrix(matrix);
        res.json({
          data: dim,
          message: `Dimension "${dim.name}" is now ${dim.enabled ? "enabled (Y)" : "disabled (N)"}.`,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  return router;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStep(input: any, index: number): Step {
  return {
    id: input.id ?? uuid(),
    order: input.order ?? index,
    enabled: input.enabled ?? true,
    type: input.type ?? "pick",
    label: input.label ?? `Step ${index + 1}`,
    template: input.template ?? "",
    dimensionRef: input.dimensionRef,
    pickCount: input.pickCount,
    stepRefs: input.stepRefs,
    generativeInstruction: input.generativeInstruction,
    constraints: input.constraints,
    outputColumn: input.outputColumn,
  };
}
