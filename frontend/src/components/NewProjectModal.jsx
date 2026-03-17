import { useState } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/store';

export default function NewProjectModal() {
  const closeModal = useStore((s) => s.closeModal);
  const createMatrix = useStore((s) => s.createMatrix);
  const createConfig = useStore((s) => s.createConfig);
  const currentMatrix = useStore((s) => s.currentMatrix);

  const [projectName, setProjectName] = useState('');
  const [configName, setConfigName] = useState('');
  const [mode, setMode] = useState('single');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const matrix = await createMatrix(projectName.trim());
    if (matrix) {
      const cfgName = configName.trim() || `${projectName.trim()} Config`;
      await createConfig({
        name: cfgName,
        matrixId: matrix.id,
        mode,
        steps: [],
        outputSettings: { outputType: ['text'] },
      });
    }

    closeModal();
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="btn-icon" onClick={closeModal}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="label">Project Name</label>
              <input
                className="input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Health Prompts, Math Questions, Career Content..."
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label">Config Name (optional)</label>
              <input
                className="input"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="Auto-generated if left blank"
              />
            </div>

            <div className="form-group">
              <label className="label">Generation Mode</label>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="single">Single — one assembled prompt</option>
                <option value="sequence">Sequence — N-scene progression</option>
                <option value="batch">Batch — multiple independent prompts</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
