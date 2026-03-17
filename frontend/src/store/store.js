// ============================================================================
// Zustand Store — global state management
// ============================================================================

import { create } from 'zustand';
import { matrixApi, configApi, engineApi } from './api';

const useStore = create((set, get) => ({
  // ─────────────────────── Matrix State ───────────────────────
  matrices: [],
  currentMatrix: null,
  matrixLoading: false,

  loadMatrices: async () => {
    set({ matrixLoading: true });
    try {
      const res = await matrixApi.list();
      set({ matrices: res.data, matrixLoading: false });
    } catch (err) {
      set({ matrixLoading: false });
      get().showToast('Failed to load matrices', 'error');
    }
  },

  selectMatrix: async (id) => {
    set({ matrixLoading: true });
    try {
      const res = await matrixApi.get(id);
      set({ currentMatrix: res.data, matrixLoading: false });
    } catch (err) {
      set({ matrixLoading: false });
      get().showToast('Failed to load matrix', 'error');
    }
  },

  createMatrix: async (name) => {
    try {
      const res = await matrixApi.create({ name, dimensions: [] });
      set((s) => ({ matrices: [...s.matrices, res.data], currentMatrix: res.data }));
      get().showToast('Matrix created', 'success');
      return res.data;
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  addDimension: async (dim) => {
    const matrix = get().currentMatrix;
    if (!matrix) return;
    try {
      const res = await matrixApi.addDimension(matrix.id, dim);
      set({ currentMatrix: res.matrix });
      get().showToast(`Column "${dim.name}" added`, 'success');
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  updateDimension: async (dimId, updates) => {
    const matrix = get().currentMatrix;
    if (!matrix) return;
    try {
      const res = await matrixApi.updateDimension(matrix.id, dimId, updates);
      set({ currentMatrix: res.matrix });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  deleteDimension: async (dimId) => {
    const matrix = get().currentMatrix;
    if (!matrix) return;
    try {
      const res = await matrixApi.deleteDimension(matrix.id, dimId);
      set({ currentMatrix: res.matrix });
      get().showToast('Column deleted', 'success');
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  addValue: async (dimId, value) => {
    const matrix = get().currentMatrix;
    if (!matrix) return;
    try {
      const res = await matrixApi.addValues(matrix.id, dimId, { value });
      set({ currentMatrix: res.matrix });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  updateValue: async (dimId, valId, value) => {
    const matrix = get().currentMatrix;
    if (!matrix) return;
    try {
      const res = await matrixApi.updateValue(matrix.id, dimId, valId, { value });
      set({ currentMatrix: res.matrix });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  deleteValue: async (dimId, valId) => {
    const matrix = get().currentMatrix;
    if (!matrix) return;
    try {
      const res = await matrixApi.deleteValue(matrix.id, dimId, valId);
      set({ currentMatrix: res.matrix });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  // ─────────────────────── Config State ───────────────────────
  configs: [],
  currentConfig: null,
  configLoading: false,

  loadConfigs: async () => {
    set({ configLoading: true });
    try {
      const res = await configApi.list();
      set({ configs: res.data, configLoading: false });
    } catch (err) {
      set({ configLoading: false });
    }
  },

  selectConfig: async (id) => {
    try {
      const res = await configApi.get(id);
      set({ currentConfig: res.data });
    } catch (err) {
      get().showToast('Failed to load config', 'error');
    }
  },

  createConfig: async (data) => {
    try {
      const res = await configApi.create(data);
      set((s) => ({ configs: [...s.configs, { id: res.data.id, name: res.data.name, mode: res.data.mode, stepCount: res.data.steps.length }], currentConfig: res.data }));
      get().showToast('Config created', 'success');
      return res.data;
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  updateConfig: async (updates) => {
    const config = get().currentConfig;
    if (!config) return;
    try {
      const res = await configApi.update(config.id, updates);
      set({ currentConfig: res.data });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  toggleStep: async (stepId, enabled) => {
    const config = get().currentConfig;
    if (!config) return;
    try {
      await configApi.toggleStep(config.id, stepId, enabled);
      // Refresh config
      const res = await configApi.get(config.id);
      set({ currentConfig: res.data });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  reorderSteps: async (stepOrder) => {
    const config = get().currentConfig;
    if (!config) return;
    try {
      const res = await configApi.reorderSteps(config.id, stepOrder);
      set({ currentConfig: res.data });
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  // ─────────────────────── Engine State ───────────────────────
  executionResult: null,
  validationResult: null,
  engineLoading: false,
  engineError: null,

  executePrompt: async () => {
    const config = get().currentConfig;
    if (!config) return get().showToast('No config selected', 'error');
    set({ engineLoading: true, engineError: null });
    try {
      const res = await engineApi.execute(config.id);
      set({ executionResult: res.data, engineLoading: false, validationResult: null });
      get().showToast(`Generated ${res.data.outputs.length} output(s)`, 'success');
    } catch (err) {
      set({ engineLoading: false, engineError: err.message });
      get().showToast(err.message, 'error');
    }
  },

  validatePrompt: async () => {
    const config = get().currentConfig;
    if (!config) return;
    set({ engineLoading: true });
    try {
      const res = await engineApi.validate(config.id);
      set({ validationResult: res, engineLoading: false });
      if (res.valid) get().showToast('Config is valid ✓', 'success');
      else get().showToast(`${res.errors.length} error(s) found`, 'error');
    } catch (err) {
      set({ engineLoading: false });
      get().showToast(err.message, 'error');
    }
  },

  previewPrompt: async () => {
    const config = get().currentConfig;
    if (!config) return;
    set({ engineLoading: true, engineError: null });
    try {
      const res = await engineApi.preview(config.id);
      set({ executionResult: res.data, engineLoading: false });
    } catch (err) {
      set({ engineLoading: false, engineError: err.message });
      get().showToast(err.message, 'error');
    }
  },

  exportPrompt: async (format = 'txt') => {
    const config = get().currentConfig;
    if (!config) return;
    try {
      const { blob, filename } = await engineApi.export(config.id, format, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      get().showToast(`Exported as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      get().showToast(err.message, 'error');
    }
  },

  // ─────────────────────── UI State ───────────────────────
  activeModal: null,
  modalData: null,
  outputTab: 'preview',
  toast: null,

  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  setOutputTab: (tab) => set({ outputTab: tab }),

  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
}));

export default useStore;
