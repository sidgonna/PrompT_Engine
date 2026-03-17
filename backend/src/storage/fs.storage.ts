// ============================================================================
// Filesystem Storage — Phase 1 implementation of IStorage
// Stores all data as JSON files on disk
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { IStorage } from "./storage.interface";
import {
  Matrix,
  PromptConfig,
  DomainTemplate,
  Session,
} from "../models/schema";

export class FileSystemStorage implements IStorage {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), "data");
    this.ensureDirectories();
  }

  // -------------------------------------------------------------------------
  // Directory setup
  // -------------------------------------------------------------------------

  private ensureDirectories(): void {
    const dirs = ["matrices", "configs", "templates", "sessions"];
    for (const dir of dirs) {
      const fullPath = path.join(this.dataDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  private getFilePath(collection: string, id: string): string {
    return path.join(this.dataDir, collection, `${id}.json`);
  }

  // -------------------------------------------------------------------------
  // Generic CRUD helpers
  // -------------------------------------------------------------------------

  private async readAll<T>(collection: string): Promise<T[]> {
    const dirPath = path.join(this.dataDir, collection);
    if (!fs.existsSync(dirPath)) return [];

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
    const items: T[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
        items.push(JSON.parse(content) as T);
      } catch {
        // Skip corrupt files
        console.warn(`Warning: Could not parse ${file} in ${collection}`);
      }
    }

    return items;
  }

  private async readOne<T>(collection: string, id: string): Promise<T | null> {
    const filePath = this.getFilePath(collection, id);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  private async writeOne<T>(collection: string, id: string, data: T): Promise<T> {
    const filePath = this.getFilePath(collection, id);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return data;
  }

  private async removeOne(collection: string, id: string): Promise<void> {
    const filePath = this.getFilePath(collection, id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
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
