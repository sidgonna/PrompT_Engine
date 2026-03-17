// ============================================================================
// Postgres Storage — Phase 5 implementation of IStorage for Cloud/Vercel
// Stores all data as JSONB blobs in a single table for serverless efficiency
// ============================================================================

import { Pool } from "pg";
import { IStorage } from "./storage.interface";
import {
  Matrix,
  PromptConfig,
  DomainTemplate,
  Session,
} from "../models/schema";

export class PostgresStorage implements IStorage {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Required for Neon/Vercel Postgres
      },
    });
    this.initTable();
  }

  private async initTable() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS master_prompter_data (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data JSONB NOT NULL,
          PRIMARY KEY (collection, id)
        );
      `);
      console.log("Postgres Storage initialized.");
    } catch (err) {
      console.error("Failed to initialize Postgres table:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Generic CRUD helpers
  // -------------------------------------------------------------------------

  private async readAll<T>(collection: string): Promise<T[]> {
    const res = await this.pool.query(
      "SELECT data FROM master_prompter_data WHERE collection = $1",
      [collection]
    );
    return res.rows.map((row) => row.data as T);
  }

  private async readOne<T>(collection: string, id: string): Promise<T | null> {
    const res = await this.pool.query(
      "SELECT data FROM master_prompter_data WHERE collection = $1 AND id = $2",
      [collection, id]
    );
    return res.rows.length ? (res.rows[0].data as T) : null;
  }

  private async writeOne<T>(collection: string, id: string, data: T): Promise<T> {
    await this.pool.query(
      `INSERT INTO master_prompter_data (collection, id, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (collection, id)
       DO UPDATE SET data = EXCLUDED.data`,
      [collection, id, JSON.stringify(data)]
    );
    return data;
  }

  private async removeOne(collection: string, id: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM master_prompter_data WHERE collection = $1 AND id = $2",
      [collection, id]
    );
  }

  // -------------------------------------------------------------------------
  // Matrix
  // -------------------------------------------------------------------------

  async getMatrices(): Promise<Matrix[]> {
    return this.readAll<Matrix>("matrices");
  }

  async getMatrix(id: string): Promise<Matrix | null> {
    return this.readOne<Matrix>("matrices", id);
  }

  async saveMatrix(matrix: Matrix): Promise<Matrix> {
    return this.writeOne("matrices", matrix.id, matrix);
  }

  async deleteMatrix(id: string): Promise<void> {
    return this.removeOne("matrices", id);
  }

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  async getConfigs(): Promise<PromptConfig[]> {
    return this.readAll<PromptConfig>("configs");
  }

  async getConfig(id: string): Promise<PromptConfig | null> {
    return this.readOne<PromptConfig>("configs", id);
  }

  async saveConfig(config: PromptConfig): Promise<PromptConfig> {
    return this.writeOne("configs", config.id, config);
  }

  async deleteConfig(id: string): Promise<void> {
    return this.removeOne("configs", id);
  }

  // -------------------------------------------------------------------------
  // Template
  // -------------------------------------------------------------------------

  async getTemplates(): Promise<DomainTemplate[]> {
    return this.readAll<DomainTemplate>("templates");
  }

  async getTemplate(id: string): Promise<DomainTemplate | null> {
    return this.readOne<DomainTemplate>("templates", id);
  }

  async saveTemplate(template: DomainTemplate): Promise<DomainTemplate> {
    return this.writeOne("templates", template.id, template);
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.removeOne("templates", id);
  }

  // -------------------------------------------------------------------------
  // Session
  // -------------------------------------------------------------------------

  async getSessions(userId?: string): Promise<Session[]> {
    const all = await this.readAll<Session>("sessions");
    if (userId) {
      return all.filter((s) => s.userId === userId);
    }
    return all;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.readOne<Session>("sessions", id);
  }

  async saveSession(session: Session): Promise<Session> {
    return this.writeOne("sessions", session.id, session);
  }

  async deleteSession(id: string): Promise<void> {
    return this.removeOne("sessions", id);
  }
}
