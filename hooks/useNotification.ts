import toast from 'react-hot-toast';

/**
 * Hook customizado para notificações toast
 * Centraliza toda a lógica de feedback visual da aplicação
 */
export const useNotification = () => {
    return {
        success: (message: string) => {
            toast.success(message, {
                duration: 4000,
                position: 'top-right',
                style: {
                    background: '#10b981',
                    color: '#fff',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    padding: '16px',
                },
                iconTheme: {
                    primary: '#fff',
                    secondary: '#10b981',
                },
            });
        },

        error: (message: string) => {
            toast.error(message, {
                duration: 5000,
                position: 'top-right',
                style: {
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    padding: '16px',
                },
                iconTheme: {
                    primary: '#fff',
                    secondary: '#ef4444',
                },
            });
        },

        warning: (message: string) => {
            toast(message, {
                duration: 4500,
                position: 'top-right',
                icon: '⚠️',
                style: {
                    background: '#f59e0b',
                    color: '#fff',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    padding: '16px',
                },
            });
        },

        info: (message: string) => {
            toast(message, {
                duration: 4000,
                position: 'top-right',
                icon: 'ℹ️',
                style: {
                    background: '#3b82f6',
                    color: '#fff',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    padding: '16px',
                },
            });
        },

        loading: (message: string) => {
            return toast.loading(message, {
                position: 'top-right',
                style: {
                    background: '#64748b',
                    color: '#fff',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    padding: '16px',
                },
            });
        },

        dismiss: (toastId?: string) => {
            toast.dismiss(toastId);
        },

        promise: <T,>(
            promise: Promise<T>,
            messages: {
                loading: string;
                success: string;
                error: string;
            }
        ) => {
            return toast.promise(
                promise,
                {
                    loading: messages.loading,
                    success: messages.success,
                    error: messages.error,
                },
                {
                    position: 'top-right',
                    style: {
                        fontWeight: 'bold',
                        borderRadius: '12px',
                        padding: '16px',
                    },
                }
            );
        },
    };
};
