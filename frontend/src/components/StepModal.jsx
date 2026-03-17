import { useState } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/store';

export default function StepModal() {
  const closeModal = useStore((s) => s.closeModal);
  const currentConfig = useStore((s) => s.currentConfig);
  const currentMatrix = useStore((s) => s.currentMatrix);
  const updateConfig = useStore((s) => s.updateConfig);

  const [label, setLabel] = useState('');
  const [type, setType] = useState('pick');
  const [template, setTemplate] = useState('');
  const [dimensionRef, setDimensionRef] = useState('');
  const [generativeInstruction, setGenerativeInstruction] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label.trim()) return;

    const newStep = {
      label: label.trim(),
      type,
      template,
      enabled: true,
      dimensionRef: (type === 'pick' || type === 'use_similar') ? dimensionRef : undefined,
      generativeInstruction: type === 'generative' ? generativeInstruction : undefined,
      stepRefs: type === 'ref' ? [] : undefined,
    };

    const existingSteps = currentConfig?.steps || [];
    updateConfig({ steps: [...existingSteps, newStep] });
    closeModal();
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Step</h2>
          <button className="btn-icon" onClick={closeModal}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="label">Step Label</label>
              <input
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Define the character, Set the scene..."
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label">Step Type</label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="pick">Pick — select from a dimension</option>
                <option value="use_similar">Use Similar — pick + synonym expansion</option>
                <option value="ref">Reference — combine earlier steps</option>
                <option value="generative">Generative — LLM-delegated instruction</option>
                <option value="constraint">Constraint — rule-based validation</option>
              </select>
            </div>

            {(type === 'pick' || type === 'use_similar') && (
              <div className="form-group">
                <label className="label">Dimension</label>
                <select
                  className="select"
                  value={dimensionRef}
                  onChange={(e) => setDimensionRef(e.target.value)}
                >
                  <option value="">Select dimension...</option>
                  {(currentMatrix?.dimensions || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.values.length} values)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(type === 'ref' || type === 'constraint') && (
              <div className="form-group">
                <label className="label">Template</label>
                <textarea
                  className="input input-mono"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={
                    type === 'ref'
                      ? 'e.g. A {step_abc123} {step_xyz456} at the park'
                      : 'e.g. Create a <emotion> <person>'
                  }
                  rows={3}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Use &lt;variable&gt; for dimension refs and {'{'} step_id {'}'} for step references
                </span>
              </div>
            )}

            {type === 'generative' && (
              <div className="form-group">
                <label className="label">Generative Instruction</label>
                <textarea
                  className="input input-mono"
                  value={generativeInstruction}
                  onChange={(e) => setGenerativeInstruction(e.target.value)}
                  placeholder="e.g. Write a short, impactful question and answer about health"
                  rows={3}
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Step
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
