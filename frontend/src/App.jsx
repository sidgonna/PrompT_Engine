import { useEffect } from 'react';
import HeaderBar from './components/HeaderBar';
import MatrixPanel from './components/MatrixPanel';
import StepBuilderPanel from './components/StepBuilderPanel';
import OutputPanel from './components/OutputPanel';
import DimensionModal from './components/DimensionModal';
import StepModal from './components/StepModal';
import NewProjectModal from './components/NewProjectModal';
import ImportExcelModal from './components/ImportExcelModal';
import ImportCodeStepsModal from './components/ImportCodeStepsModal';
import ConfirmModal from './components/ConfirmModal';
import Toast from './components/Toast';
import useStore from './store/store';
import './App.css';

function App() {
  const loadMatrices = useStore((s) => s.loadMatrices);
  const loadConfigs = useStore((s) => s.loadConfigs);
  const activeModal = useStore((s) => s.activeModal);

  useEffect(() => {
    loadMatrices();
    loadConfigs();
  }, []);

  return (
    <div className="app-layout">
      <HeaderBar />

      <div className="main-area">
        <div className="matrix-area">
          <MatrixPanel />
        </div>
        <div className="panel-divider-v" />
        <div className="step-area">
          <StepBuilderPanel />
        </div>
        <div className="panel-divider-v" />
        <div className="output-area">
          <OutputPanel />
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'dimension' && <DimensionModal />}
      {activeModal === 'step' && <StepModal />}
      {activeModal === 'newProject' && <NewProjectModal />}
      {activeModal === 'importExcel' && <ImportExcelModal />}
      {activeModal === 'importCodeSteps' && <ImportCodeStepsModal />}
      {activeModal === 'confirm' && <ConfirmModal />}

      <Toast />
    </div>
  );
}

export default App;
