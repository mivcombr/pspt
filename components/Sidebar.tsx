import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, isMobileOpen, onMobileClose }) => {
    const { user, signOut } = useAuth();
    const location = useLocation();
    const [iconLogoError, setIconLogoError] = useState(false);

    useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileOpen]);

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ to, icon, label }: { to: string; icon: string; label: string }) => {
        const active = isActive(to);
        return (
            <Link
                to={to}
                onClick={() => onMobileClose?.()}
                title={!isOpen ? label : undefined}
                className={`flex items-center w-full px-4 py-3.5 rounded-2xl transition-all group overflow-hidden whitespace-nowrap mb-1 ${active
                    ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
                    } ${!isOpen ? 'justify-center px-0 gap-0' : 'gap-3.5'}`}
            >
                <span
                    className={`material-symbols-outlined flex-shrink-0 ${isOpen || isMobileOpen ? 'text-[22px]' : 'text-[20px]'} ${active ? 'fill-1' : ''}`}
                >
                    {icon}
                </span>
                <p className={`text-sm font-semibold transition-all duration-300 ${(!isOpen && !isMobileOpen) ? 'hidden' : 'opacity-100 w-auto translate-x-0'}`}>
                    {label}
                </p>
            </Link>
        );
    };

    const isReceptionOrFinancial = user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL;

    return (
        <>
            {/* Backdrop for Mobile */}
            <div
                className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onMobileClose}
            />

            <aside
                className={`flex flex-col bg-transparent shrink-0 transition-all duration-300 ease-in-out py-4 pr-4
                ${isOpen ? 'w-72 pl-4' : 'w-20 pl-2'} 
                fixed inset-y-0 left-0 z-50 -translate-x-full lg:translate-x-0 lg:static lg:z-auto
                ${isMobileOpen ? 'translate-x-0 !fixed !w-[280px] !pl-4' : ''}
                `}
            >
                <div className="bg-surface-light dark:bg-surface-dark h-full rounded-3xl flex flex-col shadow-xl lg:shadow-sm border border-slate-100 dark:border-slate-800/50 relative">

                    {/* Header on Mobile: Close Button */}
                    <div className="flex justify-end p-4 lg:hidden shrink-0">
                        <button
                            onClick={onMobileClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Logo Area */}
                    <div className={`flex items-center shrink-0 transition-all duration-300 ${isOpen || isMobileOpen ? 'h-24 px-8 justify-start' : 'h-20 px-0 justify-center'}`}>
                        <div className={`flex items-center gap-3 overflow-hidden whitespace-nowrap`}>
                            <img
                                src={(!isOpen && !isMobileOpen && !iconLogoError) ? '/logo-icon.png' : '/logo.png'}
                                onError={() => {
                                    if (!isOpen && !isMobileOpen) {
                                        setIconLogoError(true);
                                    }
                                }}
                                alt="Logo"
                                className={`${(isOpen || isMobileOpen) ? 'h-14' : 'h-10'} w-auto object-contain transition-all`}
                            />
                        </div>
                    </div>

                    {/* Desktop Toggle Button */}
                    <button
                        onClick={onToggle}
                        className="hidden lg:flex absolute -right-3 top-8 w-6 h-6 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 items-center justify-center text-slate-400 hover:text-primary transition-colors shadow-sm z-10"
                    >
                        <span className="material-symbols-outlined text-[14px]">{isOpen ? 'chevron_left' : 'chevron_right'}</span>
                    </button>

                    {/* Nav */}
                    <nav className="flex-1 overflow-y-auto py-4 px-4 flex flex-col gap-1 overflow-x-hidden min-h-0">
                        {user?.role === UserRole.ADMIN && (
                            <>
                                <p className={`text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2 px-4 ${(!isOpen && !isMobileOpen) && 'hidden'}`}>Geral</p>
                                <NavItem to="/" icon="dashboard" label="Dashboard" />
                            </>
                        )}

                        <p className={`text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4 px-4 ${(!isOpen && !isMobileOpen) && 'hidden'}`}>Operacional</p>
                        <NavItem to="/attendances" icon="event_list" label="Atendimentos" />
                        <NavItem to="/new-appointment" icon="add_circle" label="Novo Agendamento" />
                        <NavItem to="/patients" icon="groups" label="Pacientes" />

                        {user?.role === UserRole.ADMIN && (
                            <>
                                <p className={`text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4 px-4 ${(!isOpen && !isMobileOpen) && 'hidden'}`}>Gestão</p>
                                <NavItem to="/financials" icon="account_balance_wallet" label="Financeiro" />
                                <NavItem to="/expenses" icon="pie_chart" label="Despesas" />
                                <NavItem to="/hospitals" icon="domain" label="Hospitais" />
                            </>
                        )}

                        {user?.role === UserRole.FINANCIAL && (
                            <NavItem to="/financials" icon="account_balance_wallet" label="Financeiro" />
                        )}
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 shrink-0">
                        <div className={`bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex items-center gap-3 transition-all ${!isOpen ? 'justify-center' : ''}`}>
                            <div className="size-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-primary shadow-sm shrink-0">
                                <span className="font-bold text-lg">{user?.name.charAt(0)}</span>
                            </div>

                            {(isOpen || isMobileOpen) && (
                                <div className="overflow-hidden min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {user?.role === UserRole.ADMIN ? 'Administrador' :
                                            user?.role === UserRole.RECEPTION ? 'Recepção' :
                                                user?.role === UserRole.FINANCIAL ? 'Financeiro' :
                                                    user?.role?.toLowerCase()}
                                    </p>
                                </div>
                            )}

                            {(isOpen || isMobileOpen) && (
                                <button onClick={signOut} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">logout</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
