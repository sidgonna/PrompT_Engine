import { useState } from 'react';
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Columns, GripVertical, Check, X, Upload } from 'lucide-react';
import useStore from '../store/store';
import './MatrixPanel.css';

const SELECTION_MODE_LABELS = {
  random: { label: 'RND', class: 'badge-cyan' },
  fixed: { label: 'FXD', class: 'badge-violet' },
  range: { label: 'RNG', class: 'badge-amber' },
  sequential: { label: 'SEQ', class: 'badge-green' },
};

export default function MatrixPanel() {
  const currentMatrix = useStore((s) => s.currentMatrix);
  const addDimension = useStore((s) => s.addDimension);
  const updateDimension = useStore((s) => s.updateDimension);
  const deleteDimension = useStore((s) => s.deleteDimension);
  const addValue = useStore((s) => s.addValue);
  const updateValue = useStore((s) => s.updateValue);
  const deleteValue = useStore((s) => s.deleteValue);
  const openModal = useStore((s) => s.openModal);

  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newValueInputs, setNewValueInputs] = useState({});

  if (!currentMatrix) {
    return (
      <div className="matrix-panel">
        <div className="empty-state">
          <Columns size={48} strokeWidth={1} />
          <h3>No Project Selected</h3>
          <p>Select a project from the header or create a new one to start building your matrix.</p>
          <button className="btn btn-primary" onClick={() => openModal('newProject')}>
            <Plus size={14} />
            New Project
          </button>
        </div>
      </div>
    );
  }

  const dimensions = currentMatrix.dimensions || [];
  const maxRows = Math.max(...dimensions.map((d) => d.values.length), 0);

  const handleToggleDimension = (dim) => {
    updateDimension(dim.id, { enabled: !dim.enabled });
  };

  const handleDeleteDimension = (e, dim) => {
    e.stopPropagation();
    e.preventDefault();
    openModal('confirm', {
      title: 'Delete Column',
      message: `Are you sure you want to delete "${dim.name}"? This will remove all its values and cannot be undone.`,
      confirmText: 'Delete Column',
      type: 'danger',
      onConfirm: () => deleteDimension(dim.id),
    });
  };

  const handleStartEdit = (dimId, valId, currentValue) => {
    setEditingCell(`${dimId}:${valId}`);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (dimId, valId) => {
    if (editValue.trim()) {
      updateValue(dimId, valId, editValue.trim());
    }
    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleAddValue = (dimId) => {
    const val = newValueInputs[dimId]?.trim();
    if (val) {
      addValue(dimId, val);
      setNewValueInputs({ ...newValueInputs, [dimId]: '' });
    }
  };

  const handleNewValueKeyDown = (e, dimId) => {
    if (e.key === 'Enter') handleAddValue(dimId);
  };

  const handleSelectionModeChange = (dim, newMode) => {
    updateDimension(dim.id, { selectionMode: newMode });
  };

  return (
    <div className="matrix-panel">
      {/* Toolbar */}
      <div className="matrix-toolbar">
        <div className="matrix-toolbar-left">
          <span className="section-title">
            Matrix — {currentMatrix.name}
          </span>
          <span className="matrix-count badge badge-cyan">
            {dimensions.length} columns
          </span>
        </div>
        <div className="matrix-toolbar-right">
          <button
            className="btn btn-small"
            onClick={() => openModal('importExcel')}
          >
            <Upload size={12} />
            Import Data
          </button>
          <button
            className="btn btn-small btn-primary"
            onClick={() => openModal('dimension')}
          >
            <Plus size={12} />
            Add Column
          </button>
        </div>
      </div>

      {/* Table */}
      {dimensions.length === 0 ? (
        <div className="empty-state">
          <Columns size={40} strokeWidth={1} />
          <p>No columns yet. Add your first dimension to get started.</p>
          <button className="btn btn-primary" onClick={() => openModal('dimension')}>
            <Plus size={14} />
            Add First Column
          </button>
        </div>
      ) : (
        <div className="matrix-table-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                {dimensions.map((dim) => (
                  <th key={dim.id} className={`matrix-th ${!dim.enabled ? 'dim-disabled' : ''}`}>
                    <div className="matrix-th-content">
                      <div className="matrix-th-top">
                        <span className="matrix-th-name">{dim.name}</span>
                        <div className="matrix-th-actions">
                          <button
                            className="btn-icon"
                            title={dim.enabled ? 'Disable' : 'Enable'}
                            onClick={() => handleToggleDimension(dim)}
                          >
                            {dim.enabled ? (
                              <ToggleRight size={16} className="toggle-on" />
                            ) : (
                              <ToggleLeft size={16} className="toggle-off" />
                            )}
                          </button>
                          <button
                            className="btn-icon"
                            title="Edit column"
                            onClick={() => openModal('dimension', dim)}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            title="Delete column"
                            onClick={(e) => handleDeleteDimension(e, dim)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="matrix-th-meta">
                        <select
                          className="mode-select"
                          value={dim.selectionMode}
                          onChange={(e) => handleSelectionModeChange(dim, e.target.value)}
                        >
                          <option value="random">Random</option>
                          <option value="fixed">Fixed</option>
                          <option value="range">Range</option>
                          <option value="sequential">Sequential</option>
                        </select>
                        <span className={`badge ${SELECTION_MODE_LABELS[dim.selectionMode]?.class}`}>
                          {SELECTION_MODE_LABELS[dim.selectionMode]?.label}
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, rowIdx) => (
                <tr key={rowIdx}>
                  {dimensions.map((dim) => {
                    const val = dim.values[rowIdx];
                    const cellKey = val ? `${dim.id}:${val.id}` : null;
                    const isEditing = editingCell === cellKey;

                    return (
                      <td
                        key={dim.id}
                        className={`matrix-td ${!dim.enabled ? 'dim-disabled' : ''}`}
                      >
                        {val ? (
                          isEditing ? (
                            <div className="cell-edit">
                              <input
                                className="input cell-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(dim.id, val.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                autoFocus
                              />
                              <button
                                className="btn-icon"
                                onClick={() => handleSaveEdit(dim.id, val.id)}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                className="btn-icon"
                                onClick={handleCancelEdit}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="cell-value">
                              <span
                                className="cell-text"
                                onDoubleClick={() =>
                                  handleStartEdit(dim.id, val.id, val.value)
                                }
                              >
                                {val.value}
                              </span>
                              <button
                                className="btn-icon cell-delete"
                                onClick={() => deleteValue(dim.id, val.id)}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* New value row */}
              <tr className="new-value-row">
                {dimensions.map((dim) => (
                  <td key={dim.id} className="matrix-td">
                    <div className="new-value-cell">
                      <input
                        className="input cell-input-new"
                        placeholder="+ Add value..."
                        value={newValueInputs[dim.id] || ''}
                        onChange={(e) =>
                          setNewValueInputs({
                            ...newValueInputs,
                            [dim.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => handleNewValueKeyDown(e, dim.id)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
