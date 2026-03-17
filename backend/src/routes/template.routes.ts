// ============================================================================
// Template Routes — CRUD for domain templates
// ============================================================================

import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { IStorage } from "../storage/storage.interface";
import { DomainTemplate, DomainConfig, Step } from "../models/schema";

export function createTemplateRouter(storage: IStorage): Router {
  const router = Router();

  // GET /api/templates — List all templates
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const templates = await storage.getTemplates();
      const summary = templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        stepCount: t.stepSkeleton.length,
        domainCount: t.domains.length,
        domains: t.domains.map((d) => d.domainName),
      }));
      res.json({ data: summary, count: summary.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/templates — Create a template
  router.post("/", async (req: Request, res: Response) => {
    try {
      const body = req.body;

      if (!body.name) {
        return res.status(400).json({ error: "Template name is required." });
      }

      const template: DomainTemplate = {
        id: uuid(),
        name: body.name,
        description: body.description ?? "",
        stepSkeleton: (body.stepSkeleton ?? []).map(
          (s: any, i: number) => ({
            id: s.id ?? uuid(),
            order: s.order ?? i,
            enabled: s.enabled ?? true,
            type: s.type ?? "pick",
            label: s.label ?? `Step ${i + 1}`,
            template: s.template ?? "",
            dimensionRef: s.dimensionRef,
            pickCount: s.pickCount,
            stepRefs: s.stepRefs,
            generativeInstruction: s.generativeInstruction,
            constraints: s.constraints,
            outputColumn: s.outputColumn,
          })
        ),
        outputSchema: body.outputSchema ?? [],
        domains: body.domains ?? [],
      };

      const saved = await storage.saveTemplate(template);
      res.status(201).json({ data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/templates/:id — Get a template
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }
      res.json({ data: template });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/templates/:id — Update a template
  router.put("/:id", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Template not found." });
      }

      const updated: DomainTemplate = {
        ...existing,
        name: req.body.name ?? existing.name,
        description: req.body.description ?? existing.description,
        stepSkeleton: req.body.stepSkeleton ?? existing.stepSkeleton,
        outputSchema: req.body.outputSchema ?? existing.outputSchema,
        domains: req.body.domains ?? existing.domains,
      };

      const saved = await storage.saveTemplate(updated);
      res.json({ data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/templates/:id — Delete a template
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Template not found." });
      }
      await storage.deleteTemplate(req.params.id);
      res.json({ message: "Template deleted." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------------
  // Domain attachment
  // -----------------------------------------------------------------------

  // POST /api/templates/:id/domains — Attach a domain config
  router.post("/:id/domains", async (req: Request, res: Response) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }

      const domain: DomainConfig = {
        domainName: req.body.domainName,
        matrixId: req.body.matrixId,
        dimensionMappings: req.body.dimensionMappings ?? {},
      };

      if (!domain.domainName) {
        return res
          .status(400)
          .json({ error: "domainName is required." });
      }
      if (!domain.matrixId) {
        return res
          .status(400)
          .json({ error: "matrixId is required." });
      }

      // Check for duplicate domain names
      if (template.domains.some((d) => d.domainName === domain.domainName)) {
        return res
          .status(409)
          .json({
            error: `Domain "${domain.domainName}" already exists in this template.`,
          });
      }

      template.domains.push(domain);
      const saved = await storage.saveTemplate(template);
      res.status(201).json({ data: domain, template: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/templates/:id/domains/:domainName — Remove a domain
  router.delete(
    "/:id/domains/:domainName",
    async (req: Request, res: Response) => {
      try {
        const template = await storage.getTemplate(req.params.id);
        if (!template) {
          return res.status(404).json({ error: "Template not found." });
        }

        const idx = template.domains.findIndex(
          (d) => d.domainName === req.params.domainName
        );
        if (idx === -1) {
          return res.status(404).json({ error: "Domain not found." });
        }

        template.domains.splice(idx, 1);
        const saved = await storage.saveTemplate(template);
        res.json({ message: "Domain removed.", template: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  return router;
}
