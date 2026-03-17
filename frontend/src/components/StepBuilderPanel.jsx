import { useState } from 'react';
import { Plus, GripVertical, Trash2, ChevronDown, ChevronRight, Power, Zap, Link, Sparkles, ShieldCheck, Target, Copy, Code2 } from 'lucide-react';
import useStore from '../store/store';
import './StepBuilderPanel.css';

const STEP_TYPE_CONFIG = {
  pick: { icon: Target, label: 'Pick', badge: 'badge-cyan' },
  use_similar: { icon: Sparkles, label: 'Similar', badge: 'badge-violet' },
  ref: { icon: Link, label: 'Ref', badge: 'badge-green' },
  generative: { icon: Zap, label: 'Gen', badge: 'badge-amber' },
  constraint: { icon: ShieldCheck, label: 'Rule', badge: 'badge-red' },
};

export default function StepBuilderPanel() {
  const currentConfig = useStore((s) => s.currentConfig);
  const currentMatrix = useStore((s) => s.currentMatrix);
  const toggleStep = useStore((s) => s.toggleStep);
  const updateConfig = useStore((s) => s.updateConfig);
  const openModal = useStore((s) => s.openModal);

  const [expandedStep, setExpandedStep] = useState(null);

  if (!currentConfig) {
    return (
      <div className="step-builder">
        <div className="section-header">
          <span className="section-title">Step Builder</span>
        </div>
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <Zap size={32} strokeWidth={1} />
          <p style={{ fontSize: '11px' }}>Select or create a config to define steps.</p>
        </div>
      </div>
    );
  }

  const steps = currentConfig.steps || [];

  const handleDeleteStep = (stepId) => {
    const newSteps = steps.filter((s) => s.id !== stepId);
    updateConfig({ steps: newSteps });
  };

  return (
    <div className="step-builder">
      {/* Steps Section */}
      <div className="section-header">
        <span className="section-title">Steps ({steps.length})</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-small" onClick={() => openModal('importCodeSteps')}>
            <Code2 size={12} />
            Code Steps
          </button>
          <button className="btn btn-small btn-primary" onClick={() => openModal('step')}>
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>

      <div className="step-list">
        {steps.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <p style={{ fontSize: '11px' }}>No steps defined. Add your first step.</p>
          </div>
        ) : (
          steps.map((step, idx) => {
            const typeConfig = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.pick;
            const Icon = typeConfig.icon;
            const isExpanded = expandedStep === step.id;

            return (
              <div
                key={step.id}
                className={`step-card glass-card ${!step.enabled ? 'step-disabled' : ''}`}
              >
                <div
                  className="step-card-header"
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                >
                  <div className="step-card-left">
                    <GripVertical size={12} className="step-grip" />
                    <span className="step-order">{idx + 1}</span>
                    <span className={`badge ${typeConfig.badge}`}>
                      <Icon size={10} />
                      {typeConfig.label}
                    </span>
                    <span className="step-label">{step.label}</span>
                  </div>
                  <div className="step-card-right">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStep(step.id, !step.enabled);
                      }}
                      title={step.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power size={12} className={step.enabled ? 'toggle-on' : 'toggle-off'} />
                    </button>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="step-card-body">
                    {/* Template */}
                    {/* Step Label & Type Edit */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="label">Step Label</label>
                        <input
                          className="input"
                          value={step.label || ''}
                          onChange={(e) => {
                            const newSteps = steps.map((s) =>
                              s.id === step.id ? { ...s, label: e.target.value } : s
                            );
                            updateConfig({ steps: newSteps });
                          }}
                          placeholder="e.g. Pick Character"
                        />
                      </div>
                      
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="label">Step Type</label>
                        <select
                          className="select"
                          value={step.type}
                          onChange={(e) => {
                            const newType = e.target.value;
                            const newSteps = steps.map((s) => {
                              if (s.id === step.id) {
                                return {
                                  ...s,
                                  type: newType,
                                  // Clear incompatible fields
                                  dimensionRef: ['pick', 'use_similar'].includes(newType) ? s.dimensionRef : undefined,
                                  template: ['ref', 'constraint'].includes(newType) ? s.template : undefined,
                                  stepRefs: newType === 'ref' ? s.stepRefs : undefined,
                                  generativeInstruction: newType === 'generative' ? s.generativeInstruction : undefined
                                };
                              }
                              return s;
                            });
                            updateConfig({ steps: newSteps });
                          }}
                        >
                          <option value="pick">Pick</option>
                          <option value="use_similar">Use Similar</option>
                          <option value="ref">Reference</option>
                          <option value="generative">Generative</option>
                          <option value="constraint">Constraint</option>
                        </select>
                      </div>
                    </div>

                    {/* Template */}
                    {(step.type === 'ref' || step.type === 'constraint') && (
                      <div className="form-group">
                        <label className="label">Template</label>
                        <textarea
                          className="input input-mono"
                          value={step.template || ''}
                          onChange={(e) => {
                            const newSteps = steps.map((s) =>
                              s.id === step.id ? { ...s, template: e.target.value } : s
                            );
                            updateConfig({ steps: newSteps });
                          }}
                          placeholder="e.g. A <emotion> <person> standing at <place>"
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Dimension ref (for pick / use_similar) */}
                    {(step.type === 'pick' || step.type === 'use_similar') && (
                      <div className="form-group">
                        <label className="label">Dimension</label>
                        <select
                          className="select"
                          value={step.dimensionRef || ''}
                          onChange={(e) => {
                            const newSteps = steps.map((s) =>
                              s.id === step.id ? { ...s, dimensionRef: e.target.value } : s
                            );
                            updateConfig({ steps: newSteps });
                          }}
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

                    {/* Step refs (for ref type) */}
                    {step.type === 'ref' && (
                      <div className="form-group">
                        <label className="label">References</label>
                        <div className="step-refs-list">
                          {steps
                            .filter((s) => s.id !== step.id)
                            .map((s) => (
                              <label key={s.id} className="step-ref-check">
                                <input
                                  type="checkbox"
                                  checked={(step.stepRefs || []).includes(s.id)}
                                  onChange={(e) => {
                                    const refs = step.stepRefs || [];
                                    const newRefs = e.target.checked
                                      ? [...refs, s.id]
                                      : refs.filter((r) => r !== s.id);
                                    const newSteps = steps.map((st) =>
                                      st.id === step.id ? { ...st, stepRefs: newRefs } : st
                                    );
                                    updateConfig({ steps: newSteps });
                                  }}
                                />
                                <span>{s.label}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Generative instruction */}
                    {step.type === 'generative' && (
                      <div className="form-group">
                        <label className="label">Generative Instruction</label>
                        <textarea
                          className="input input-mono"
                          value={step.generativeInstruction || ''}
                          onChange={(e) => {
                            const newSteps = steps.map((s) =>
                              s.id === step.id ? { ...s, generativeInstruction: e.target.value } : s
                            );
                            updateConfig({ steps: newSteps });
                          }}
                          placeholder="e.g. Write a short, impactful question and answer"
                          rows={2}
                        />
                      </div>
                    )}

                    <div className="step-card-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          const duplicate = { 
                            ...step, 
                            id: crypto.randomUUID(), 
                            label: step.label + ' (Copy)' 
                          };
                          const stepIndex = steps.findIndex(s => s.id === step.id);
                          const newSteps = [...steps];
                          newSteps.splice(stepIndex + 1, 0, duplicate);
                          updateConfig({ steps: newSteps });
                        }}
                      >
                        <Copy size={11} />
                        Duplicate
                      </button>
                      
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => handleDeleteStep(step.id)}
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Settings */}
      <div className="quick-settings">
        <div className="section-header">
          <span className="section-title">Output Settings</span>
        </div>
        <div className="quick-settings-body">
          <div className="form-group">
            <label className="label">Output Type</label>
            <select
              className="select"
              value={currentConfig.outputSettings?.outputType?.[0] || 'text'}
              onChange={(e) => {
                updateConfig({
                  outputSettings: {
                    ...currentConfig.outputSettings,
                    outputType: [e.target.value],
                  },
                });
              }}
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="image_with_content">Image + Content</option>
              <option value="seq_image">Sequence Image</option>
              <option value="seq_text">Sequence Text</option>
              <option value="formatted_text">Formatted Text</option>
              <option value="video">Video</option>
              <option value="presentation">Presentation</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Tone</label>
            <select
              className="select"
              value={currentConfig.outputSettings?.tone || ''}
              onChange={(e) => {
                updateConfig({
                  outputSettings: {
                    ...currentConfig.outputSettings,
                    tone: e.target.value,
                  },
                });
              }}
            >
              <option value="">None</option>
              <option value="funny">Funny</option>
              <option value="scientific">Scientific</option>
              <option value="motivational">Motivational</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="dramatic">Dramatic</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Word Count</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                className="input"
                type="number"
                placeholder="Min"
                style={{ width: '70px' }}
                value={
                  typeof currentConfig.outputSettings?.wordCount === 'object'
                    ? currentConfig.outputSettings.wordCount.min || ''
                    : ''
                }
                onChange={(e) => {
                  const wc = typeof currentConfig.outputSettings?.wordCount === 'object'
                    ? currentConfig.outputSettings.wordCount
                    : { min: 0, max: 0 };
                  updateConfig({
                    outputSettings: {
                      ...currentConfig.outputSettings,
                      wordCount: { ...wc, min: parseInt(e.target.value) || 0 },
                    },
                  });
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
              <input
                className="input"
                type="number"
                placeholder="Max"
                style={{ width: '70px' }}
                value={
                  typeof currentConfig.outputSettings?.wordCount === 'object'
                    ? currentConfig.outputSettings.wordCount.max || ''
                    : ''
                }
                onChange={(e) => {
                  const wc = typeof currentConfig.outputSettings?.wordCount === 'object'
                    ? currentConfig.outputSettings.wordCount
                    : { min: 0, max: 0 };
                  updateConfig({
                    outputSettings: {
                      ...currentConfig.outputSettings,
                      wordCount: { ...wc, max: parseInt(e.target.value) || 0 },
                    },
                  });
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Format</label>
            <select
              className="select"
              value={currentConfig.outputSettings?.format || ''}
              onChange={(e) => {
                updateConfig({
                  outputSettings: {
                    ...currentConfig.outputSettings,
                    format: e.target.value,
                  },
                });
              }}
            >
              <option value="">Default</option>
              <option value="vertical">Vertical</option>
              <option value="widescreen">Widescreen</option>
              <option value="mobile">Mobile</option>
              <option value="square">Square</option>
            </select>
          </div>

          {currentConfig.mode === 'batch' && (
            <div className="form-group">
              <label className="label">Batch Iterations</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={currentConfig.batchSettings?.totalCount || ''}
                onChange={(e) => {
                  updateConfig({
                    batchSettings: {
                      ...currentConfig.batchSettings,
                      totalCount: parseInt(e.target.value) || undefined,
                    },
                  });
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Number of unique outputs to generate.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
