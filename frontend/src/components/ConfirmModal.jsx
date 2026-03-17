import { AlertTriangle, X } from 'lucide-react';
import useStore from '../store/store';
import './ConfirmModal.css';

export default function ConfirmModal() {
  const modalData = useStore((s) => s.modalData);
  const closeModal = useStore((s) => s.closeModal);

  if (!modalData) return null;

  const { title, message, onConfirm, confirmText, type } = modalData;

  const handleConfirm = () => {
    onConfirm?.();
    closeModal();
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="confirm-header-content">
            <AlertTriangle className={type === 'danger' ? 'text-danger' : 'text-amber'} size={20} />
            <h2>{title || 'Confirm Action'}</h2>
          </div>
          <button className="btn-icon" onClick={closeModal}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p>{message || 'Are you sure you want to proceed?'}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={closeModal}>
            Cancel
          </button>
          <button 
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={handleConfirm}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
