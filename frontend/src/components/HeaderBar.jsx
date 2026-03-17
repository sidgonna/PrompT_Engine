import { Zap, Plus, Settings, ChevronDown } from 'lucide-react';
import useStore from '../store/store';
import './HeaderBar.css';

export default function HeaderBar() {
  const matrices = useStore((s) => s.matrices);
  const currentMatrix = useStore((s) => s.currentMatrix);
  const selectMatrix = useStore((s) => s.selectMatrix);
  const configs = useStore((s) => s.configs);
  const currentConfig = useStore((s) => s.currentConfig);
  const selectConfig = useStore((s) => s.selectConfig);
  const openModal = useStore((s) => s.openModal);
  const updateConfig = useStore((s) => s.updateConfig);

  const handleMatrixChange = (e) => {
    const id = e.target.value;
    if (id === '__new') {
      openModal('newProject');
    } else if (id) {
      selectMatrix(id);
    }
  };

  const handleConfigChange = (e) => {
    const id = e.target.value;
    if (id) selectConfig(id);
  };

  const handleModeChange = (e) => {
    updateConfig({ mode: e.target.value });
  };

  return (
    <header className="header-bar">
      <div className="header-left">
        <div className="header-logo">
          <Zap size={18} className="logo-icon" />
          <span className="logo-text">Master Prompter</span>
        </div>
      </div>

      <div className="header-center">
        {/* Project Selector */}
        <div className="header-control">
          <label className="header-label">Project</label>
          <select
            className="select header-select"
            value={currentMatrix?.id || ''}
            onChange={handleMatrixChange}
          >
            <option value="">Select project...</option>
            {matrices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__new">+ New Project</option>
          </select>
        </div>

        {/* Config Selector */}
        <div className="header-control">
          <label className="header-label">Config</label>
          <select
            className="select header-select"
            value={currentConfig?.id || ''}
            onChange={handleConfigChange}
          >
            <option value="">Select config...</option>
            {configs
              .filter((c) => !currentMatrix || c.matrixId === currentMatrix?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        {/* Mode Selector */}
        <div className="header-control">
          <label className="header-label">Mode</label>
          <select
            className="select header-select"
            value={currentConfig?.mode || 'single'}
            onChange={handleModeChange}
            disabled={!currentConfig}
          >
            <option value="single">Single</option>
            <option value="sequence">Sequence</option>
            <option value="batch">Batch</option>
          </select>
        </div>
      </div>

      <div className="header-right">
        <button className="btn btn-small" onClick={() => openModal('newProject')}>
          <Plus size={14} />
          New
        </button>
      </div>
    </header>
  );
}
