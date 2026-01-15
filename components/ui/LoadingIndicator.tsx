import React from 'react';

type LoadingIndicatorProps = {
    label?: string;
    className?: string;
};

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ label = 'Carregando...', className = '' }) => (
    <div className={`inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 ${className}`}>
        <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
        <span>{label}</span>
    </div>
);
