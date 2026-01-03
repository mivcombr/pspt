import React from 'react';

interface BadgeProps {
    status: string;
    className?: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    'Agendado': { label: 'Agendado', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
    'Atendido': { label: 'Atendido', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
    'Cancelado': { label: 'Cancelado', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-500' },
    'Falhou': { label: 'Falhou', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
    'Pago': { label: 'Pago', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    'Pendente': { label: 'Pendente', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
    'Não realizado': { label: 'Não realizado', bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-400', dot: 'bg-slate-300' },
};

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
    const config = statusConfig[status] || { label: status, bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} ${className}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
            {config.label}
        </span>
    );
};

export default Badge;
