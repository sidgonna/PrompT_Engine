// ============================================================================
// Storage Interface — abstract contract for Phase 1 (FS) and Phase 2 (DB)
// ============================================================================

import {
  Matrix,
  PromptConfig,
  DomainTemplate,
  Session,
} from "../models/schema";

export interface IStorage {
  // --- Matrix ---
  getMatrices(): Promise<Matrix[]>;
  getMatrix(id: string): Promise<Matrix | null>;
  saveMatrix(matrix: Matrix): Promise<Matrix>;
  deleteMatrix(id: string): Promise<void>;

  // --- Config ---
  getConfigs(): Promise<PromptConfig[]>;
  getConfig(id: string): Promise<PromptConfig | null>;
  saveConfig(config: PromptConfig): Promise<PromptConfig>;
  deleteConfig(id: string): Promise<void>;

  // --- Template ---
  getTemplates(): Promise<DomainTemplate[]>;
  getTemplate(id: string): Promise<DomainTemplate | null>;
  saveTemplate(template: DomainTemplate): Promise<DomainTemplate>;
  deleteTemplate(id: string): Promise<void>;

  // --- Session ---
  getSessions(userId?: string): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  saveSession(session: Session): Promise<Session>;
  deleteSession(id: string): Promise<void>;
}
