// ============================================================================
// Matrix Routes — CRUD for matrices and dimensions
// ============================================================================

import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { IStorage } from "../storage/storage.interface";
import { Matrix, Dimension, DimensionValue } from "../models/schema";

export function createMatrixRouter(storage: IStorage): Router {
  const router = Router();

  // -----------------------------------------------------------------------
  // Matrix CRUD
  // -----------------------------------------------------------------------

  // GET /api/matrices — List all matrices
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const matrices = await storage.getMatrices();
      res.json({ data: matrices, count: matrices.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/matrices — Create a new matrix
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { name, dimensions } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Matrix name is required." });
      }

      const matrix: Matrix = {
        id: uuid(),
        name,
        dimensions: (dimensions ?? []).map((d: any) => ({
          id: d.id ?? uuid(),
          name: d.name,
          enabled: d.enabled ?? true,
          selectionMode: d.selectionMode ?? "random",
          fixedValue: d.fixedValue,
          rangeMin: d.rangeMin,
          rangeMax: d.rangeMax,
          values: (d.values ?? []).map((v: any) => ({
            id: v.id ?? uuid(),
            value: v.value,
            weight: v.weight,
            synonyms: v.synonyms,
          })),
          synonymPools: d.synonymPools,
          metadata: d.metadata,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await storage.saveMatrix(matrix);
      res.status(201).json({ data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/matrices/:id — Get a matrix by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const matrix = await storage.getMatrix(req.params.id);
      if (!matrix) {
        return res.status(404).json({ error: "Matrix not found." });
      }
      res.json({ data: matrix });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/matrices/:id — Update a matrix
  router.put("/:id", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getMatrix(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Matrix not found." });
      }

      const updated: Matrix = {
        ...existing,
        name: req.body.name ?? existing.name,
        dimensions: req.body.dimensions ?? existing.dimensions,
        updatedAt: new Date().toISOString(),
      };

      const saved = await storage.saveMatrix(updated);
      res.json({ data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/matrices/:id — Delete a matrix
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getMatrix(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Matrix not found." });
      }
      await storage.deleteMatrix(req.params.id);
      res.json({ message: "Matrix deleted." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------------
  // Dimension CRUD (nested under matrix)
  // -----------------------------------------------------------------------

  // POST /api/matrices/:id/dimensions — Add a dimension
  router.post("/:id/dimensions", async (req: Request, res: Response) => {
    try {
      const matrix = await storage.getMatrix(req.params.id);
      if (!matrix) {
        return res.status(404).json({ error: "Matrix not found." });
      }

      const dim: Dimension = {
        id: uuid(),
        name: req.body.name,
        enabled: req.body.enabled ?? true,
        selectionMode: req.body.selectionMode ?? "random",
        fixedValue: req.body.fixedValue,
        rangeMin: req.body.rangeMin,
        rangeMax: req.body.rangeMax,
        values: (req.body.values ?? []).map((v: any) => ({
          id: v.id ?? uuid(),
          value: v.value,
          weight: v.weight,
          synonyms: v.synonyms,
        })),
        synonymPools: req.body.synonymPools,
        metadata: req.body.metadata,
      };

      matrix.dimensions.push(dim);
      matrix.updatedAt = new Date().toISOString();

      const saved = await storage.saveMatrix(matrix);
      res.status(201).json({ data: dim, matrix: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/matrices/:id/dimensions/:dimId — Update a dimension
  router.put(
    "/:id/dimensions/:dimId",
    async (req: Request, res: Response) => {
      try {
        const matrix = await storage.getMatrix(req.params.id);
        if (!matrix) {
          return res.status(404).json({ error: "Matrix not found." });
        }

        const dimIndex = matrix.dimensions.findIndex(
          (d) => d.id === req.params.dimId
        );
        if (dimIndex === -1) {
          return res.status(404).json({ error: "Dimension not found." });
        }

        const existing = matrix.dimensions[dimIndex];
        matrix.dimensions[dimIndex] = {
          ...existing,
          name: req.body.name ?? existing.name,
          enabled: req.body.enabled ?? existing.enabled,
          selectionMode: req.body.selectionMode ?? existing.selectionMode,
          fixedValue: req.body.fixedValue ?? existing.fixedValue,
          rangeMin: req.body.rangeMin ?? existing.rangeMin,
          rangeMax: req.body.rangeMax ?? existing.rangeMax,
          values: req.body.values ?? existing.values,
          synonymPools: req.body.synonymPools ?? existing.synonymPools,
          metadata: req.body.metadata ?? existing.metadata,
        };

        matrix.updatedAt = new Date().toISOString();
        const saved = await storage.saveMatrix(matrix);
        res.json({ data: matrix.dimensions[dimIndex], matrix: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // DELETE /api/matrices/:id/dimensions/:dimId — Delete a dimension
  router.delete(
    "/:id/dimensions/:dimId",
    async (req: Request, res: Response) => {
      try {
        const matrix = await storage.getMatrix(req.params.id);
        if (!matrix) {
          return res.status(404).json({ error: "Matrix not found." });
        }

        const dimIndex = matrix.dimensions.findIndex(
          (d) => d.id === req.params.dimId
        );
        if (dimIndex === -1) {
          return res.status(404).json({ error: "Dimension not found." });
        }

        matrix.dimensions.splice(dimIndex, 1);
        matrix.updatedAt = new Date().toISOString();

        const saved = await storage.saveMatrix(matrix);
        res.json({ message: "Dimension deleted.", matrix: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // -----------------------------------------------------------------------
  // Value CRUD (nested under dimension)
  // -----------------------------------------------------------------------

  // POST /api/matrices/:id/dimensions/:dimId/values — Add value(s)
  router.post(
    "/:id/dimensions/:dimId/values",
    async (req: Request, res: Response) => {
      try {
        const matrix = await storage.getMatrix(req.params.id);
        if (!matrix) {
          return res.status(404).json({ error: "Matrix not found." });
        }

        const dim = matrix.dimensions.find(
          (d) => d.id === req.params.dimId
        );
        if (!dim) {
          return res.status(404).json({ error: "Dimension not found." });
        }

        // Support single value or array of values
        const incoming = Array.isArray(req.body.values)
          ? req.body.values
          : [req.body];

        const newValues: DimensionValue[] = incoming.map((v: any) => ({
          id: v.id ?? uuid(),
          value: v.value,
          weight: v.weight,
          synonyms: v.synonyms,
        }));

        dim.values.push(...newValues);
        matrix.updatedAt = new Date().toISOString();

        const saved = await storage.saveMatrix(matrix);
        res.status(201).json({ data: newValues, matrix: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // PUT /api/matrices/:id/dimensions/:dimId/values/:valId — Update a value
  router.put(
    "/:id/dimensions/:dimId/values/:valId",
    async (req: Request, res: Response) => {
      try {
        const matrix = await storage.getMatrix(req.params.id);
        if (!matrix) {
          return res.status(404).json({ error: "Matrix not found." });
        }

        const dim = matrix.dimensions.find(
          (d) => d.id === req.params.dimId
        );
        if (!dim) {
          return res.status(404).json({ error: "Dimension not found." });
        }

        const valIndex = dim.values.findIndex(
          (v) => v.id === req.params.valId
        );
        if (valIndex === -1) {
          return res.status(404).json({ error: "Value not found." });
        }

        dim.values[valIndex] = {
          ...dim.values[valIndex],
          value: req.body.value ?? dim.values[valIndex].value,
          weight: req.body.weight ?? dim.values[valIndex].weight,
          synonyms: req.body.synonyms ?? dim.values[valIndex].synonyms,
        };

        matrix.updatedAt = new Date().toISOString();
        const saved = await storage.saveMatrix(matrix);
        res.json({ data: dim.values[valIndex], matrix: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // DELETE /api/matrices/:id/dimensions/:dimId/values/:valId — Remove a value
  router.delete(
    "/:id/dimensions/:dimId/values/:valId",
    async (req: Request, res: Response) => {
      try {
        const matrix = await storage.getMatrix(req.params.id);
        if (!matrix) {
          return res.status(404).json({ error: "Matrix not found." });
        }

        const dim = matrix.dimensions.find(
          (d) => d.id === req.params.dimId
        );
        if (!dim) {
          return res.status(404).json({ error: "Dimension not found." });
        }

        const valIndex = dim.values.findIndex(
          (v) => v.id === req.params.valId
        );
        if (valIndex === -1) {
          return res.status(404).json({ error: "Value not found." });
        }

        dim.values.splice(valIndex, 1);
        matrix.updatedAt = new Date().toISOString();

        const saved = await storage.saveMatrix(matrix);
        res.json({ message: "Value deleted.", matrix: saved });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  return router;
}
