import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';
import { hospitalService } from '../services/hospitalService';
import { roleLabel } from '../lib/permissions';
import { UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface AccessUser {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    hospital_id: string | null;
    hospital_name: string | null;
    created_at: string;
}

interface AuditEntry {
    id: string;
    actor_email: string | null;
    target_email: string | null;
    action: string;
    metadata: any;
    created_at: string;
}

const formatDate = (d?: string | null) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return '—'; }
};

const AccessControl: React.FC = () => {
    const { user: me } = useAuth();
    const [users, setUsers] = useState<AccessUser[]>([]);
    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<'users' | 'audit'>('users');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

    const load = async () => {
        setIsLoading(true);
        try {
            const [u, h, a] = await Promise.all([
                userService.getAllAccessOverview(),
                hospitalService.getAll(),
                userService.getAuditLog(200),
            ]);
            setUsers((u as any) || []);
            setHospitals((h as any)?.map((x: any) => ({ id: x.id, name: x.name })) || []);
            setAudit((a as any) || []);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao carregar dados');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        return users.filter(u => {
            if (search && !(`${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))) return false;
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
            if (statusFilter === 'ACTIVE' && !u.is_active) return false;
            if (statusFilter === 'INACTIVE' && u.is_active) return false;
            return true;
        });
    }, [users, search, roleFilter, statusFilter]);

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.is_active).length,
        inactive: users.filter(u => !u.is_active).length,
        admins: users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
    }), [users]);

    const toggleActive = async (u: AccessUser) => {
        if (u.id === me?.id) { toast.error('Você não pode desativar o próprio usuário.'); return; }
        const action = u.is_active ? 'DEACTIVATE' : 'ACTIVATE';
        const label = u.is_active ? 'desativar' : 'ativar';
        if (!confirm(`Tem certeza que deseja ${label} ${u.name}?`)) return;
        try {
            await userService.manageUser(u.id, action);
            toast.success(`Usuário ${label === 'ativar' ? 'ativado' : 'desativado'}.`);
            load();
        } catch (e: any) {
            toast.error(e.message || `Erro ao ${label}.`);
        }
    };

    const changeRole = async (u: AccessUser, newRole: string) => {
        if (newRole === u.role) return;
        if (!confirm(`Alterar role de ${u.name} para ${roleLabel(newRole)}?`)) return;
        try {
            await userService.manageUser(u.id, 'SET_ROLE', newRole);
            toast.success('Role atualizado.');
            load();
        } catch (e: any) {
            toast.error(e.message || 'Erro ao alterar role.');
        }
    };

    const changeHospital = async (u: AccessUser, newHospitalId: string) => {
        if (newHospitalId === (u.hospital_id || '')) return;
        try {
            await userService.manageUser(u.id, 'SET_HOSPITAL', newHospitalId || null);
            toast.success('Hospital atualizado.');
            load();
        } catch (e: any) {
            toast.error(e.message || 'Erro ao alterar hospital.');
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Controle de Acessos</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie todos os usuários, permissões e histórico de acessos do sistema.</p>
                </div>
                <button onClick={load} className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary text-sm font-bold text-slate-700 dark:text-slate-200">
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    Atualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total de Usuários', value: stats.total, icon: 'group', color: 'text-slate-600' },
                    { label: 'Ativos', value: stats.active, icon: 'check_circle', color: 'text-green-600' },
                    { label: 'Inativos', value: stats.inactive, icon: 'block', color: 'text-red-600' },
                    { label: 'Administradores', value: stats.admins, icon: 'shield_person', color: 'text-primary' },
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className={`material-symbols-outlined text-[22px] ${s.color}`}>{s.icon}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                {[
                    { id: 'users', label: 'Usuários', icon: 'group' },
                    { id: 'audit', label: 'Histórico de Acessos', icon: 'history' },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'users' && (
                <>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                placeholder="Buscar por nome ou e-mail..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary"
                            />
                        </div>
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold">
                            <option value="ALL">Todos os Roles</option>
                            <option value="SUPER_ADMIN">Super Administrador</option>
                            <option value="ADMIN">Administrador</option>
                            <option value="FINANCIAL">Financeiro</option>
                            <option value="RECEPTION">Recepção</option>
                        </select>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold">
                            <option value="ALL">Todos os Status</option>
                            <option value="ACTIVE">Ativos</option>
                            <option value="INACTIVE">Inativos</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="text-left px-5 py-4">Usuário</th>
                                        <th className="text-left px-5 py-4">Role</th>
                                        <th className="text-left px-5 py-4">Hospital</th>
                                        <th className="text-left px-5 py-4">Status</th>

                                        <th className="text-right px-5 py-4">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {isLoading && (
                                        <tr><td colSpan={6} className="py-12 text-center text-slate-400">Carregando...</td></tr>
                                    )}
                                    {!isLoading && filtered.length === 0 && (
                                        <tr><td colSpan={6} className="py-12 text-center text-slate-400">Nenhum usuário encontrado.</td></tr>
                                    )}
                                    {filtered.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">{u.name?.charAt(0)?.toUpperCase()}</div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                                                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <select
                                                    value={u.role}
                                                    disabled={u.id === me?.id}
                                                    onChange={(e) => changeRole(u, e.target.value)}
                                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold disabled:opacity-50"
                                                >
                                                    <option value="SUPER_ADMIN">Super Admin</option>
                                                    <option value="ADMIN">Administrador</option>
                                                    <option value="FINANCIAL">Financeiro</option>
                                                    <option value="RECEPTION">Recepção</option>
                                                </select>
                                            </td>
                                            <td className="px-5 py-4">
                                                <select
                                                    value={u.hospital_id || ''}
                                                    onChange={(e) => changeHospital(u, e.target.value)}
                                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium max-w-[180px]"
                                                >
                                                    <option value="">— Nenhum —</option>
                                                    {hospitals.map(h => (
                                                        <option key={h.id} value={h.id}>{h.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    <span className="size-1.5 rounded-full bg-current"></span>
                                                    {u.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => toggleActive(u)}
                                                    disabled={u.id === me?.id}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">{u.is_active ? 'block' : 'check_circle'}</span>
                                                    {u.is_active ? 'Desativar' : 'Ativar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {tab === 'audit' && (
                <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="text-left px-5 py-4">Data/Hora</th>
                                    <th className="text-left px-5 py-4">Ação</th>
                                    <th className="text-left px-5 py-4">Executado por</th>
                                    <th className="text-left px-5 py-4">Alvo</th>
                                    <th className="text-left px-5 py-4">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {isLoading && <tr><td colSpan={5} className="py-12 text-center text-slate-400">Carregando...</td></tr>}
                                {!isLoading && audit.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-400">Nenhum registro.</td></tr>}
                                {audit.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(a.created_at)}</td>
                                        <td className="px-5 py-3">
                                            <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-300">{a.action}</span>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">{a.actor_email || '—'}</td>
                                        <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">{a.target_email || '—'}</td>
                                        <td className="px-5 py-3 text-xs text-slate-500">
                                            <code className="font-mono">{a.metadata ? JSON.stringify(a.metadata) : ''}</code>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessControl;
