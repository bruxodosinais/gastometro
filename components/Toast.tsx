'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

export interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastItemProps {
  toast: ToastData;
  onRemove: (id: number) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-300 ${
        isSuccess
          ? 'bg-green-950 border-green-800 text-green-300'
          : 'bg-red-950 border-red-800 text-red-300'
      }`}
    >
      {isSuccess ? (
        <CheckCircle size={16} className="flex-shrink-0 text-green-400" />
      ) : (
        <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
      )}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: number) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 min-w-[280px] max-w-sm w-full px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

let _counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  function addToast(message: string, type: ToastType = 'success') {
    const id = ++_counter;
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, addToast, removeToast };
}
