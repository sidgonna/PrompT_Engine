// ============================================================================
// Master Prompter — Express Server Entry Point
// ============================================================================

import express from "express";
import cors from "cors";
import { FileSystemStorage } from "./storage/fs.storage";
import { PostgresStorage } from "./storage/postgres.storage";
import { IStorage } from "./storage/storage.interface";
import { createMatrixRouter } from "./routes/matrix.routes";
import { createConfigRouter } from "./routes/config.routes";
import { createTemplateRouter } from "./routes/template.routes";
import { createEngineRouter } from "./routes/engine.routes";
import { createSessionRouter } from "./routes/session.routes";
import { createUploadRouter } from "./routes/upload.routes";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DATA_DIR = process.env.DATA_DIR ?? undefined; // default: ./data
const POSTGRES_URL = process.env.POSTGRES_URL;

// ---------------------------------------------------------------------------
// Initialize storage
// ---------------------------------------------------------------------------

let storage: IStorage;

if (POSTGRES_URL) {
  console.log("Configuring Postgres Storage...");
  storage = new PostgresStorage(POSTGRES_URL);
} else {
  console.log("Configuring FileSystem Storage...");
  storage = new FileSystemStorage(DATA_DIR);
}

// ---------------------------------------------------------------------------
// Create Express app
// ---------------------------------------------------------------------------

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

app.use("/api/matrices", createMatrixRouter(storage));
app.use("/api/configs", createConfigRouter(storage));
app.use("/api/templates", createTemplateRouter(storage));
app.use("/api/engine", createEngineRouter(storage));
app.use("/api/sessions", createSessionRouter(storage));
app.use("/api/upload", createUploadRouter(storage));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    dataDir: DATA_DIR ?? "./data",
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested endpoint does not exist.",
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         Master Prompter Backend v1.0.0           ║
╠══════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}        ║
║  Data directory: ${DATA_DIR ?? "./data"}                       ║
╚══════════════════════════════════════════════════╝

API Endpoints:
  GET    /api/health
  
  Matrix:
  GET    /api/matrices
  POST   /api/matrices
  GET    /api/matrices/:id
  PUT    /api/matrices/:id
  DELETE /api/matrices/:id
  POST   /api/matrices/:id/dimensions
  PUT    /api/matrices/:id/dimensions/:dimId
  DELETE /api/matrices/:id/dimensions/:dimId
  POST   /api/matrices/:id/dimensions/:dimId/values
  PUT    /api/matrices/:id/dimensions/:dimId/values/:valId
  DELETE /api/matrices/:id/dimensions/:dimId/values/:valId
  
  Config:
  GET    /api/configs
  POST   /api/configs
  GET    /api/configs/:id
  PUT    /api/configs/:id
  DELETE /api/configs/:id
  PATCH  /api/configs/:id/steps/reorder
  PATCH  /api/configs/:id/steps/:stepId/toggle
  PATCH  /api/configs/:id/dimensions/:dimId/toggle
  
  Template:
  GET    /api/templates
  POST   /api/templates
  GET    /api/templates/:id
  PUT    /api/templates/:id
  DELETE /api/templates/:id
  POST   /api/templates/:id/domains
  DELETE /api/templates/:id/domains/:domainName
  
  Engine:
  POST   /api/engine/validate
  POST   /api/engine/preview
  POST   /api/engine/execute
  POST   /api/engine/export
  
  Session:
  GET    /api/sessions
  GET    /api/sessions/:id
  DELETE /api/sessions/:id
  `);
});

export default app;
