import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface MobileHeaderProps {
    onMenuToggle: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onMenuToggle }) => {
    const { signOut } = useAuth();

    return (
        <header className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shrink-0 z-30 lg:hidden">
            <div className="flex items-center gap-3 sm:gap-4">
                <button
                    onClick={onMenuToggle}
                    className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                    aria-label="Abrir menu"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <img src="/logo.png" alt="Logo" className="h-8 sm:h-10 w-auto object-contain" />
            </div>

            <button
                onClick={signOut}
                className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95"
                aria-label="Sair"
            >
                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[20px]">logout</span>
            </button>
        </header>
    );
};

export default MobileHeader;
