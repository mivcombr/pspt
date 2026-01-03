import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
    overflow?: 'hidden' | 'visible' | 'auto';
}

export const Card: React.FC<CardProps> = ({ children, className = '', noPadding = false, overflow = 'hidden' }) => {
    const overflowClass = overflow === 'visible' ? 'overflow-visible' : overflow === 'auto' ? 'overflow-auto' : 'overflow-hidden';

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow ${overflowClass} ${!noPadding ? 'p-6' : ''} ${className}`}>
            {children}
        </div>
    );
};

export default Card;
