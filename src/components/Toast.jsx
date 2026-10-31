import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  const color = type === 'success' ? 'bg-secondary' : 'bg-danger';
  const Icon = type === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`${color} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[260px]`}>
        <Icon size={18} />
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-auto opacity-80 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}