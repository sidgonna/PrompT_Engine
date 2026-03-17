import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, ArrowRight } from 'lucide-react';
import useStore from '../store/store';
import { uploadApi } from '../store/api';
import './ImportExcelModal.css';

export default function ImportExcelModal() {
  const closeModal = useStore((s) => s.closeModal);
  const showToast = useStore((s) => s.showToast);
  const matrices = useStore((s) => s.matrices);
  const currentMatrix = useStore((s) => s.currentMatrix);
  const loadMatrices = useStore((s) => s.loadMatrices);
  const selectMatrix = useStore((s) => s.selectMatrix);

  // States
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Sheets, 3: Success
  const [previewData, setPreviewData] = useState([]); // Array of sheet preview objects
  const [sheetConfigs, setSheetConfigs] = useState({}); // sheetName -> config
  const [importResults, setImportResults] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    try {
      const res = await uploadApi.previewExcel(selectedFile);
      setPreviewData(res.sheets || []);

      // Initialize default sheet configs
      const initialConfigs = {};
      (res.sheets || []).forEach((sheet) => {
        initialConfigs[sheet.sheetName] = {
          action: currentMatrix ? 'append' : 'new_project',
          targetMatrixId: currentMatrix ? currentMatrix.id : '',
          newMatrixName: sheet.sheetName,
          headerRowIndex: 0,
          collisionStrategy: 'append',
        };
      });
      setSheetConfigs(initialConfigs);
      setStep(2);
    } catch (err) {
      showToast('Failed to parse Excel file: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateSheetConfig = (sheetName, updates) => {
    setSheetConfigs((prev) => ({
      ...prev,
      [sheetName]: { ...prev[sheetName], ...updates },
    }));
  };

  const handleExecuteImport = async () => {
    // Validate custom matrix names
    const sheetsToProcess = previewData.map(s => s.sheetName).filter(name => sheetConfigs[name].action !== 'ignore');
    if (sheetsToProcess.length === 0) {
      return showToast('No sheets selected for import', 'error');
    }

    const finalConfig = {
      sheets: sheetsToProcess.map(name => ({
        sheetName: name,
        ...sheetConfigs[name]
      }))
    };

    setLoading(true);
    try {
      const res = await uploadApi.executeExcel(file, finalConfig);
      
      // Refresh matrices to show new data
      await loadMatrices();
      
      // If we appended to the current matrix, refresh it specifically
      if (currentMatrix && finalConfig.sheets.some(s => s.action === 'append' || s.action === 'replace')) {
        await selectMatrix(currentMatrix.id);
      }
      
      setImportResults(res.results);
      setStep(3);
      showToast('Import completed successfully', 'success');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal import-excel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Excel Data</h2>
          <button className="btn-icon" onClick={closeModal}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
              />
              <div className="dropzone-content">
                {loading ? (
                  <Loader2 size={48} className="spin text-primary" />
                ) : (
                  <>
                    <FileSpreadsheet size={48} className="text-muted" />
                    <h3>Click or drag Excel file to upload</h3>
                    <p>Supports .xlsx files with multiple sheets</p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mapping-container">
              <div className="mapping-header">
                <div>
                  <strong>File:</strong> {file?.name}
                </div>
                <div className="text-muted text-sm">
                  {previewData.length} sheet(s) detected
                </div>
              </div>

              <div className="sheet-list">
                {previewData.map((sheet, idx) => {
                  const config = sheetConfigs[sheet.sheetName];
                  if (!config) return null;

                  return (
                    <div key={idx} className="sheet-card glass-card">
                      <div className="sheet-card-header">
                        <div className="sheet-title">
                          <FileSpreadsheet size={14} className="text-primary" />
                          <span>{sheet.sheetName}</span>
                          <span className="badge badge-cyan">{sheet.rowCount} rows</span>
                        </div>
                        <div className="sheet-action">
                          <select
                            className="select select-sm"
                            value={config.action}
                            onChange={(e) => updateSheetConfig(sheet.sheetName, { action: e.target.value })}
                          >
                            <option value="new_project">New Project</option>
                            <option value="append">Append to Project</option>
                            <option value="replace">Replace in Project</option>
                            <option value="ignore">Ignore Sheet</option>
                          </select>
                        </div>
                      </div>

                      {config.action !== 'ignore' && (
                        <div className="sheet-card-body">
                          {/* Config Options Line */}
                          <div className="sheet-config-row">
                            {(config.action === 'append' || config.action === 'replace') && (
                              <div className="form-group-inline">
                                <label className="label-sm">Target Project</label>
                                <select
                                  className="select select-sm"
                                  value={config.targetMatrixId}
                                  onChange={(e) => updateSheetConfig(sheet.sheetName, { targetMatrixId: e.target.value })}
                                >
                                  <option value="">Select Project...</option>
                                  {matrices.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {config.action === 'new_project' && (
                              <div className="form-group-inline">
                                <label className="label-sm">Project Name</label>
                                <input
                                  className="input input-sm"
                                  value={config.newMatrixName}
                                  onChange={(e) => updateSheetConfig(sheet.sheetName, { newMatrixName: e.target.value })}
                                />
                              </div>
                            )}

                            {(config.action === 'append' || config.action === 'replace') && (
                              <div className="form-group-inline">
                                <label className="label-sm">Collision Strategy</label>
                                <select
                                  className="select select-sm"
                                  value={config.collisionStrategy}
                                  onChange={(e) => updateSheetConfig(sheet.sheetName, { collisionStrategy: e.target.value })}
                                >
                                  <option value="skip">Skip duplicates</option>
                                  <option value="append">Allow duplicates</option>
                                  <option value="replace">Wipe existing dimensions</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Preview & Header Selection */}
                          <div className="sheet-preview-wrap">
                            <label className="label-sm mb-xs">Select Header Row (First 5 rows displayed)</label>
                            <div className="table-responsive">
                              <table className="preview-table">
                                <tbody>
                                  {sheet.previewRows.map((row, rIdx) => {
                                    const isHeader = rIdx === config.headerRowIndex;
                                    return (
                                      <tr
                                        key={rIdx}
                                        className={isHeader ? 'preview-row header-active' : 'preview-row'}
                                        onClick={() => updateSheetConfig(sheet.sheetName, { headerRowIndex: rIdx })}
                                      >
                                        <td className="row-selector">
                                          <input
                                            type="radio"
                                            checked={isHeader}
                                            readOnly
                                          />
                                        </td>
                                        {row.map((cell, cIdx) => (
                                          <td key={cIdx}>{cell}</td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && importResults && (
            <div className="success-state">
              <div className="success-icon-wrap">
                <FileSpreadsheet size={48} className="text-success" />
                <div className="check-badge">✓</div>
              </div>
              <h3>Import Complete!</h3>
              <div className="results-grid">
                <div className="result-stat">
                  <span className="stat-label">Projects Created</span>
                  <span className="stat-val text-primary">{importResults.addedMatrices}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">Dimensions Added</span>
                  <span className="stat-val text-violet">{importResults.addedDimensions}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">Values Imported</span>
                  <span className="stat-val text-cyan">{importResults.addedValues}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">Duplicates Skipped</span>
                  <span className="stat-val text-muted">{importResults.skipped}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={closeModal}>
            {step === 3 ? 'Close' : 'Cancel'}
          </button>
          
          {step === 2 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecuteImport}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <>Import Data <ArrowRight size={14} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
