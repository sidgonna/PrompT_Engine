import { useState } from 'react';
import { Play, CheckCircle, Clipboard, Download, FileText, FileJson, FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import useStore from '../store/store';
import './OutputPanel.css';

export default function OutputPanel() {
  const executionResult = useStore((s) => s.executionResult);
  const validationResult = useStore((s) => s.validationResult);
  const engineLoading = useStore((s) => s.engineLoading);
  const engineError = useStore((s) => s.engineError);
  const outputTab = useStore((s) => s.outputTab);
  const setOutputTab = useStore((s) => s.setOutputTab);
  const executePrompt = useStore((s) => s.executePrompt);
  const validatePrompt = useStore((s) => s.validatePrompt);
  const previewPrompt = useStore((s) => s.previewPrompt);
  const exportPrompt = useStore((s) => s.exportPrompt);
  const showToast = useStore((s) => s.showToast);
  const currentConfig = useStore((s) => s.currentConfig);

  const [currentOutputIdx, setCurrentOutputIdx] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  const outputs = executionResult?.outputs || [];
  const currentOutput = outputs[currentOutputIdx];

  const handleCopy = () => {
    if (currentOutput) {
      navigator.clipboard.writeText(currentOutput.prompt);
      showToast('Copied to clipboard', 'success');
    }
  };

  const handleCopyAll = () => {
    if (outputs.length > 0) {
      const allText = outputs.map((o, i) =>
        `--- Output ${i + 1}${o.sceneLabel ? ` (${o.sceneLabel})` : ''} ---\n${o.prompt}`
      ).join('\n\n');
      navigator.clipboard.writeText(allText);
      showToast('All outputs copied', 'success');
    }
  };

  return (
    <div className="output-panel">
      {/* Toolbar */}
      <div className="output-toolbar">
        <div className="output-toolbar-left">
          {/* Tab bar */}
          <div className="output-tabs">
            <button
              className={`output-tab ${outputTab === 'preview' ? 'active' : ''}`}
              onClick={() => setOutputTab('preview')}
            >
              Preview
            </button>
            <button
              className={`output-tab ${outputTab === 'raw' ? 'active' : ''}`}
              onClick={() => setOutputTab('raw')}
            >
              Raw JSON
            </button>
            <button
              className={`output-tab ${outputTab === 'meta' ? 'active' : ''}`}
              onClick={() => setOutputTab('meta')}
            >
              Metadata
            </button>
          </div>
        </div>

        <div className="output-toolbar-right">
          <button
            className="btn btn-small"
            onClick={validatePrompt}
            disabled={engineLoading || !currentConfig}
            title="Validate config"
          >
            <CheckCircle size={12} />
            Validate
          </button>

          <button
            className="btn btn-small btn-primary"
            onClick={executePrompt}
            disabled={engineLoading || !currentConfig}
          >
            {engineLoading ? <Loader2 size={12} className="spin" /> : <Play size={12} />}
            Execute
          </button>

          <button
            className="btn btn-small"
            onClick={handleCopy}
            disabled={!currentOutput}
            title="Copy current output"
          >
            <Clipboard size={12} />
          </button>

          <div className="export-dropdown-wrapper">
            <button
              className="btn btn-small"
              onClick={() => setExportOpen(!exportOpen)}
              disabled={!executionResult}
            >
              <Download size={12} />
              Export
            </button>
            {exportOpen && (
              <div className="export-dropdown">
                <button onClick={() => { exportPrompt('txt'); setExportOpen(false); }}>
                  <FileText size={12} /> TXT
                </button>
                <button onClick={() => { exportPrompt('json'); setExportOpen(false); }}>
                  <FileJson size={12} /> JSON
                </button>
                <button onClick={() => { exportPrompt('csv'); setExportOpen(false); }}>
                  <FileSpreadsheet size={12} /> CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Output navigation for multiple outputs */}
      {outputs.length > 1 && (
        <div className="output-nav">
          <button
            className="btn-icon"
            onClick={() => setCurrentOutputIdx(Math.max(0, currentOutputIdx - 1))}
            disabled={currentOutputIdx === 0}
          >
            <ChevronLeft size={14} />
          </button>
          <div className="output-nav-tabs">
            {outputs.map((o, i) => (
              <button
                key={i}
                className={`output-nav-tab ${i === currentOutputIdx ? 'active' : ''}`}
                onClick={() => setCurrentOutputIdx(i)}
              >
                {o.sceneLabel ? `Scene ${i + 1}` : `#${i + 1}`}
              </button>
            ))}
          </div>
          <button
            className="btn-icon"
            onClick={() => setCurrentOutputIdx(Math.min(outputs.length - 1, currentOutputIdx + 1))}
            disabled={currentOutputIdx === outputs.length - 1}
          >
            <ChevronRight size={14} />
          </button>
          <button className="btn btn-small" onClick={handleCopyAll}>
            <Clipboard size={11} />
            Copy All
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="output-content">
        {/* Validation result */}
        {validationResult && !executionResult && (
          <div className="validation-result">
            {validationResult.valid ? (
              <div className="validation-ok">
                <CheckCircle size={16} />
                Config is valid ✓
              </div>
            ) : (
              <div className="validation-errors">
                {validationResult.errors?.map((e, i) => (
                  <div key={i} className="validation-error">
                    <AlertTriangle size={12} />
                    <span className="error-code">[{e.code}]</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}
            {(validationResult.warnings?.length > 0) && (
              <div className="validation-warnings">
                {validationResult.warnings.map((w, i) => (
                  <div key={i} className="validation-warning">
                    <AlertTriangle size={12} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {engineError && (
          <div className="output-error">
            <AlertTriangle size={14} />
            <span>{engineError}</span>
          </div>
        )}

        {/* Loading */}
        {engineLoading && (
          <div className="output-loading">
            <Loader2 size={20} className="spin" />
            <span>Generating...</span>
          </div>
        )}

        {/* No result yet */}
        {!executionResult && !validationResult && !engineLoading && !engineError && (
          <div className="empty-state">
            <Play size={32} strokeWidth={1} />
            <p>Click <strong>Execute</strong> to generate prompts</p>
          </div>
        )}

        {/* Preview tab */}
        {outputTab === 'preview' && currentOutput && (
          <div className="output-preview">
            {currentOutput.sceneLabel && (
              <div className="scene-label badge badge-violet">
                {currentOutput.sceneLabel}
              </div>
            )}
            
            {currentOutput.context && (
              <div className="output-context-box" style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div className="section-title" style={{ marginBottom: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>VARIABLES / CONTEXT</div>
                <pre className="output-text" style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, padding: 0, background: 'transparent', border: 'none' }}>{currentOutput.context}</pre>
              </div>
            )}

            <div className="output-prompt-box" style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px', border: '1px solid var(--primary-color)' }}>
              <div className="section-title" style={{ marginBottom: '8px', fontSize: '11px', color: 'var(--primary-color)' }}>FINAL PROMPT / GENERATION</div>
              <pre className="output-text" style={{ margin: 0, padding: 0, background: 'transparent', border: 'none' }}>{currentOutput.prompt}</pre>
            </div>
            {currentOutput.outputColumns && (
              <div className="output-columns">
                <div className="section-title" style={{ marginBottom: '8px' }}>Structured Output</div>
                <table className="output-columns-table">
                  <tbody>
                    {Object.entries(currentOutput.outputColumns).map(([col, val]) => (
                      <tr key={col}>
                        <td className="output-col-name">{col}</td>
                        <td className="output-col-val">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Raw JSON tab */}
        {outputTab === 'raw' && executionResult && (
          <pre className="output-text output-json">
            {JSON.stringify(executionResult, null, 2)}
          </pre>
        )}

       {/* Metadata tab */}
        {outputTab === 'meta' && executionResult && (
          <div className="output-meta">
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Execution Time</span>
                <span className="meta-value">{executionResult.metadata.totalTime}ms</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Steps Executed</span>
                <span className="meta-value">{executionResult.metadata.stepsExecuted}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Steps Skipped</span>
                <span className="meta-value">{executionResult.metadata.stepsSkipped}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Total Outputs</span>
                <span className="meta-value">{executionResult.outputs.length}</span>
              </div>
            </div>
            {executionResult.metadata.warnings.length > 0 && (
              <div className="meta-warnings">
                <div className="section-title" style={{ marginBottom: '8px' }}>Warnings</div>
                {executionResult.metadata.warnings.map((w, i) => (
                  <div key={i} className="validation-warning">
                    <AlertTriangle size={12} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="meta-resolved">
              <div className="section-title" style={{ marginBottom: '8px' }}>Resolved Values</div>
              <table className="output-columns-table">
                <tbody>
                  {Object.entries(executionResult.resolvedValues || {}).map(([key, val]) => (
                    <tr key={key}>
                      <td className="output-col-name">{key}</td>
                      <td className="output-col-val">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
