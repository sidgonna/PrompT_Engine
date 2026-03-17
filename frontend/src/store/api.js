// ============================================================================
// API Layer — fetch wrapper for all backend endpoints
// ============================================================================

const BASE_URL = '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);

  // Handle file downloads (export)
  if (res.headers.get('content-disposition')?.includes('attachment')) {
    const blob = await res.blob();
    return { blob, filename: res.headers.get('content-disposition').split('filename="')[1]?.replace('"', '') };
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}

// --- Matrix API ---
export const matrixApi = {
  list: () => request('/matrices'),
  get: (id) => request(`/matrices/${id}`),
  create: (body) => request('/matrices', { method: 'POST', body }),
  update: (id, body) => request(`/matrices/${id}`, { method: 'PUT', body }),
  delete: (id) => request(`/matrices/${id}`, { method: 'DELETE' }),

  addDimension: (matrixId, body) =>
    request(`/matrices/${matrixId}/dimensions`, { method: 'POST', body }),
  updateDimension: (matrixId, dimId, body) =>
    request(`/matrices/${matrixId}/dimensions/${dimId}`, { method: 'PUT', body }),
  deleteDimension: (matrixId, dimId) =>
    request(`/matrices/${matrixId}/dimensions/${dimId}`, { method: 'DELETE' }),

  addValues: (matrixId, dimId, body) =>
    request(`/matrices/${matrixId}/dimensions/${dimId}/values`, { method: 'POST', body }),
  updateValue: (matrixId, dimId, valId, body) =>
    request(`/matrices/${matrixId}/dimensions/${dimId}/values/${valId}`, { method: 'PUT', body }),
  deleteValue: (matrixId, dimId, valId) =>
    request(`/matrices/${matrixId}/dimensions/${dimId}/values/${valId}`, { method: 'DELETE' }),
};

// --- Config API ---
export const configApi = {
  list: () => request('/configs'),
  get: (id) => request(`/configs/${id}`),
  create: (body) => request('/configs', { method: 'POST', body }),
  update: (id, body) => request(`/configs/${id}`, { method: 'PUT', body }),
  delete: (id) => request(`/configs/${id}`, { method: 'DELETE' }),
  reorderSteps: (id, stepOrder) =>
    request(`/configs/${id}/steps/reorder`, { method: 'PATCH', body: { stepOrder } }),
  toggleStep: (configId, stepId, enabled) =>
    request(`/configs/${configId}/steps/${stepId}/toggle`, { method: 'PATCH', body: { enabled } }),
  toggleDimension: (configId, dimId, enabled) =>
    request(`/configs/${configId}/dimensions/${dimId}/toggle`, { method: 'PATCH', body: { enabled } }),
};

// --- Engine API ---
export const engineApi = {
  validate: (configId) =>
    request('/engine/validate', { method: 'POST', body: { configId } }),
  preview: (configId) =>
    request('/engine/preview', { method: 'POST', body: { configId } }),
  execute: (configId) =>
    request('/engine/execute', { method: 'POST', body: { configId } }),
  export: async (configId, format = 'txt', includeMetadata = false) => {
    const res = await fetch(`${BASE_URL}/engine/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId, format, includeMetadata }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Export failed');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const filename = disposition.split('filename="')[1]?.replace('"', '') || `export.${format}`;
    return { blob, filename };
  },
};

// --- Template API ---
export const templateApi = {
  list: () => request('/templates'),
  get: (id) => request(`/templates/${id}`),
  create: (body) => request('/templates', { method: 'POST', body }),
  update: (id, body) => request(`/templates/${id}`, { method: 'PUT', body }),
  delete: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  addDomain: (templateId, body) =>
    request(`/templates/${templateId}/domains`, { method: 'POST', body }),
  removeDomain: (templateId, domainName) =>
    request(`/templates/${templateId}/domains/${domainName}`, { method: 'DELETE' }),
};

// --- Session API ---
export const sessionApi = {
  list: (userId) => request(`/sessions${userId ? `?userId=${userId}` : ''}`),
  get: (id) => request(`/sessions/${id}`),
  delete: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
};

// --- Upload API ---
export const uploadApi = {
  previewExcel: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/upload/excel/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  executeExcel: async (file, config) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));
    const res = await fetch(`${BASE_URL}/upload/excel/execute`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};
