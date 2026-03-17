import useStore from '../store/store';

export default function Toast() {
  const toast = useStore((s) => s.toast);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type}`}>
      {toast.message}
    </div>
  );
}
