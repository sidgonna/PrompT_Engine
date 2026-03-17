import { useState } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/store';

export default function DimensionModal() {
  const closeModal = useStore((s) => s.closeModal);
  const addDimension = useStore((s) => s.addDimension);
  const updateDimension = useStore((s) => s.updateDimension);
  const modalData = useStore((s) => s.modalData); // null = create, object = edit

  const isEdit = !!modalData;

  const [name, setName] = useState(modalData?.name || '');
  const [selectionMode, setSelectionMode] = useState(modalData?.selectionMode || 'random');
  const [fixedValue, setFixedValue] = useState(modalData?.fixedValue || '');
  const [rangeMin, setRangeMin] = useState(modalData?.rangeMin ?? 0);
  const [rangeMax, setRangeMax] = useState(modalData?.rangeMax ?? 0);
  const [bulkValues, setBulkValues] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const dimData = {
      name: name.trim(),
      selectionMode,
      fixedValue: selectionMode === 'fixed' ? fixedValue : undefined,
      rangeMin: selectionMode === 'range' ? rangeMin : undefined,
      rangeMax: selectionMode === 'range' ? rangeMax : undefined,
    };

    if (isEdit) {
      updateDimension(modalData.id, dimData);
    } else {
      // Parse bulk values
      const values = bulkValues
        .split('\n')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .map((v) => ({ value: v }));

      addDimension({ ...dimData, values });
    }

    closeModal();
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Column' : 'Add Column'}</h2>
          <button className="btn-icon" onClick={closeModal}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="label">Column Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emotions, People, Quirks..."
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label">Selection Mode</label>
              <select
                className="select"
                value={selectionMode}
                onChange={(e) => setSelectionMode(e.target.value)}
              >
                <option value="random">Random — pick randomly each time</option>
                <option value="fixed">Fixed — always use one value</option>
                <option value="range">Range — pick within index range</option>
                <option value="sequential">Sequential — cycle through in order</option>
              </select>
            </div>

            {selectionMode === 'fixed' && (
              <div className="form-group">
                <label className="label">Fixed Value</label>
                <input
                  className="input"
                  value={fixedValue}
                  onChange={(e) => setFixedValue(e.target.value)}
                  placeholder="The value to always use"
                />
              </div>
            )}

            {selectionMode === 'range' && (
              <div className="form-group">
                <label className="label">Index Range</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    className="input"
                    type="number"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(parseInt(e.target.value) || 0)}
                    placeholder="Min"
                    style={{ width: '80px' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input
                    className="input"
                    type="number"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(parseInt(e.target.value) || 0)}
                    placeholder="Max"
                    style={{ width: '80px' }}
                  />
                </div>
              </div>
            )}

            {!isEdit && (
              <div className="form-group">
                <label className="label">Values (one per line)</label>
                <textarea
                  className="input input-mono"
                  value={bulkValues}
                  onChange={(e) => setBulkValues(e.target.value)}
                  placeholder={"Happy\nSad\nAngry\nExcited\n..."}
                  rows={6}
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? 'Save Changes' : 'Add Column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
