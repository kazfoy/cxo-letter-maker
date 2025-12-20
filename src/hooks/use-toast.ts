import { useState, useEffect, useCallback } from 'react';

type ToastType = 'default' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

// Simple event bus for toasts
const listeners: Array<(toasts: Toast[]) => void> = [];
let memoryToasts: Toast[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener([...memoryToasts]));
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { ...props, id };
  memoryToasts = [...memoryToasts, newToast];
  notifyListeners();

  if (props.duration !== Infinity) {
    setTimeout(() => {
      dismiss(id);
    }, props.duration || 5000);
  }

  return id;
}

function dismiss(id: string) {
  memoryToasts = memoryToasts.filter((t) => t.id !== id);
  notifyListeners();
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(memoryToasts);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const index = listeners.indexOf(setToasts);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toast,
    dismiss,
    toasts,
  };
}
