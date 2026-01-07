'use client';

import { useToast, type Toast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';

export function Toaster() {
    const { toasts, dismiss } = useToast();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animation trigger
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for animation
    };

    const bgColors = {
        default: 'bg-white border-gray-200 text-gray-900',
        success: 'bg-green-50 border-green-200 text-green-900',
        error: 'bg-red-50 border-red-200 text-red-900',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    };

    const type = toast.type || 'default';

    return (
        <div
            className={`
        pointer-events-auto
        flex w-full flex-col gap-1 rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out
        ${bgColors[type]}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
            role="alert"
        >
            <div className="flex justify-between items-start gap-2">
                {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
                <button
                    onClick={handleDismiss}
                    className="text-gray-400 hover:text-gray-900 transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            {toast.description && <div className="text-sm opacity-90">{toast.description}</div>}
        </div>
    );
}
