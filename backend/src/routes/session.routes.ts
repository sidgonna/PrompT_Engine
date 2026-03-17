// ============================================================================
// Session Routes — Execution history
// ============================================================================

import { Router, Request, Response } from "express";
import { IStorage } from "../storage/storage.interface";

export function createSessionRouter(storage: IStorage): Router {
  const router = Router();

  // GET /api/sessions — List all sessions (optionally filter by userId)
  router.get("/", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      const sessions = await storage.getSessions(userId);

      // Return lightweight list
      const summary = sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        configId: s.configId,
        matrixId: s.matrixId,
        outputCount: s.executionResult.outputs.length,
        totalTime: s.executionResult.metadata.totalTime,
        createdAt: s.createdAt,
      }));

      res.json({ data: summary, count: summary.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions/:id — Get a full session with execution results
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found." });
      }
      res.json({ data: session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/sessions/:id — Delete a session
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found." });
      }
      await storage.deleteSession(req.params.id);
      res.json({ message: "Session deleted." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
