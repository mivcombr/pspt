import React, { useState, useEffect, useMemo } from 'react';
import { prospectService } from '../services/prospectService';
import { profileService } from '../services/profileService';
import { Prospect, ProspectActivity, ProspectPriority, ProspectStage } from '../types';
import { formatCurrency, formatDate, formatPhoneMask, parseCurrency } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';

interface StageConfig {
    key: ProspectStage;
    label: string;
    icon: string;
    dot: string;
    header: string;
}

const STAGES: StageConfig[] = [
    { key: 'novo', label: 'Novo Contato', icon: 'person_add', dot: 'bg-slate-400', header: 'text-slate-500' },
    { key: 'contato', label: 'Contato Feito', icon: 'call', dot: 'bg-blue-500', header: 'text-blue-600 dark:text-blue-400' },
    { key: 'reuniao', label: 'Reunião Agendada', icon: 'event', dot: 'bg-indigo-500', header: 'text-indigo-600 dark:text-indigo-400' },
    { key: 'proposta', label: 'Proposta Enviada', icon: 'description', dot: 'bg-purple-500', header: 'text-purple-600 dark:text-purple-400' },
    { key: 'negociacao', label: 'Negociação', icon: 'handshake', dot: 'bg-amber-500', header: 'text-amber-600 dark:text-amber-400' },
    { key: 'fechado', label: 'Fechado', icon: 'verified', dot: 'bg-green-500', header: 'text-green-600 dark:text-green-400' },
    { key: 'perdido', label: 'Perdido', icon: 'cancel', dot: 'bg-red-500', header: 'text-red-600 dark:text-red-400' },
];

const STAGE_LABELS: Record<ProspectStage, string> = STAGES.reduce(
    (acc, s) => ({ ...acc, [s.key]: s.label }),
    {} as Record<ProspectStage, string>
);

const PRIORITY_STYLES: Record<ProspectPriority, string> = {
    'Alta': 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
    'Média': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    'Baixa': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

const ACTIVITY_TYPES: { key: ProspectActivity['type']; label: string; icon: string }[] = [
    { key: 'nota', label: 'Nota', icon: 'sticky_note_2' },
    { key: 'ligacao', label: 'Ligação', icon: 'call' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
    { key: 'email', label: 'E-mail', icon: 'mail' },
    { key: 'reuniao', label: 'Reunião', icon: 'groups' },
    { key: 'estagio', label: 'Mudança de etapa', icon: 'swap_horiz' },
];

const SEGMENTS = ['Hospital', 'Clínica', 'Laboratório', 'Consultório', 'Operadora', 'Outro'];
const SOURCES = ['Indicação', 'Prospecção ativa', 'Evento', 'Inbound', 'Redes sociais', 'Outro'];
const OWNER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'];

const emptyForm = (stage: ProspectStage = 'novo') => ({
    id: '',
    name: '',
    stage,
    segment: '',
    contact_name: '',
    contact_role: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    source: '',
    priority: 'Média' as ProspectPriority,
    estimated_value: '',
    owner_id: '',
    next_action: '',
    next_action_at: '',
    notes: '',
    lost_reason: '',
});

type ProspectForm = ReturnType<typeof emptyForm>;

const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const initials = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const Prospects: React.FC = () => {
    const { user } = useAuth();
    const notify = useNotification();

    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [owners, setOwners] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [ownerFilter, setOwnerFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');

    // Modal do card
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'dados' | 'historico'>('dados');
    const [form, setForm] = useState<ProspectForm>(emptyForm());
    const [isEditing, setIsEditing] = useState(false);

    // Histórico
    const [activities, setActivities] = useState<ProspectActivity[]>([]);
    const [isLoadingActivities, setIsLoadingActivities] = useState(false);
    const [activityForm, setActivityForm] = useState<{ type: ProspectActivity['type']; content: string }>({
        type: 'nota',
        content: '',
    });

    // Arrastar e soltar
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ stage: ProspectStage; beforeId: string | null } | null>(null);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, variant: 'info' });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [prospectsData, profiles] = await Promise.all([
                prospectService.getAll(),
                profileService.getAll(),
            ]);
            setProspects(prospectsData);
            setOwners((profiles || []).filter((p: any) => OWNER_ROLES.includes(p.role) && p.is_active !== false));
        } catch (err) {
            console.error('Error fetching prospects:', err);
            notify.error('Erro ao carregar a prospecção');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ownerName = (id?: string | null) => owners.find(o => o.id === id)?.name as string | undefined;

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return prospects.filter(p => {
            if (ownerFilter && p.owner_id !== ownerFilter) return false;
            if (priorityFilter && p.priority !== priorityFilter) return false;
            if (!term) return true;
            return [p.name, p.contact_name, p.city, p.segment, p.email, p.phone]
                .some(field => field?.toLowerCase().includes(term));
        });
    }, [prospects, searchTerm, ownerFilter, priorityFilter]);

    const byStage = (stage: ProspectStage) =>
        filtered.filter(p => p.stage === stage).sort((a, b) => a.position - b.position);

    const stageTotal = (stage: ProspectStage) =>
        byStage(stage).reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);

    const summary = useMemo(() => {
        const open = prospects.filter(p => p.stage !== 'fechado' && p.stage !== 'perdido');
        const won = prospects.filter(p => p.stage === 'fechado');
        const lost = prospects.filter(p => p.stage === 'perdido');
        const closed = won.length + lost.length;
        const today = todayISO();
        return {
            open: open.length,
            pipeline: open.reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0),
            won: won.length,
            wonValue: won.reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0),
            conversion: closed > 0 ? Math.round((won.length / closed) * 100) : 0,
            overdue: open.filter(p => p.next_action_at && p.next_action_at < today).length,
        };
    }, [prospects]);

    // ------------------------------------------------------------------
    // Arrastar e soltar
    // ------------------------------------------------------------------
    const applyMove = async (id: string, targetStage: ProspectStage, beforeId: string | null) => {
        const moving = prospects.find(p => p.id === id);
        if (!moving) return;
        if (moving.stage === targetStage && beforeId === id) return;

        const column = prospects
            .filter(p => p.stage === targetStage && p.id !== id)
            .sort((a, b) => a.position - b.position);

        const idx = beforeId ? column.findIndex(p => p.id === beforeId) : -1;
        column.splice(idx === -1 ? column.length : idx, 0, { ...moving, stage: targetStage });

        const moves = column
            .map((p, i) => ({ id: p.id, stage: targetStage, position: i }))
            .filter(m => {
                const original = prospects.find(p => p.id === m.id)!;
                return original.stage !== m.stage || original.position !== m.position;
            });

        if (moves.length === 0) return;

        const previous = prospects;
        // Atualização otimista: o kanban precisa responder no instante do soltar.
        setProspects(prev => prev.map(p => {
            const move = moves.find(m => m.id === p.id);
            return move ? { ...p, stage: move.stage, position: move.position } : p;
        }));

        try {
            await prospectService.reorder(moves);
            if (moving.stage !== targetStage) {
                await prospectService.addActivity({
                    prospect_id: id,
                    type: 'estagio',
                    content: `${STAGE_LABELS[moving.stage]} → ${STAGE_LABELS[targetStage]}`,
                    author_name: user?.name,
                });
            }
        } catch (err) {
            console.error('Error moving prospect:', err);
            setProspects(previous);
            notify.error('Não foi possível mover o card');
        }
    };

    const handleDrop = (stage: ProspectStage) => {
        const id = draggingId;
        const before = dropTarget?.stage === stage ? dropTarget.beforeId : null;
        setDraggingId(null);
        setDropTarget(null);
        if (id) applyMove(id, stage, before);
    };

    // ------------------------------------------------------------------
    // Modal
    // ------------------------------------------------------------------
    const openCreate = (stage: ProspectStage) => {
        setForm(emptyForm(stage));
        setIsEditing(false);
        setModalTab('dados');
        setActivities([]);
        setIsModalOpen(true);
    };

    const openEdit = async (prospect: Prospect) => {
        setForm({
            id: prospect.id,
            name: prospect.name,
            stage: prospect.stage,
            segment: prospect.segment || '',
            contact_name: prospect.contact_name || '',
            contact_role: prospect.contact_role || '',
            phone: prospect.phone || '',
            email: prospect.email || '',
            city: prospect.city || '',
            state: prospect.state || '',
            source: prospect.source || '',
            priority: prospect.priority,
            estimated_value: prospect.estimated_value != null
                ? Number(prospect.estimated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '',
            owner_id: prospect.owner_id || '',
            next_action: prospect.next_action || '',
            next_action_at: prospect.next_action_at || '',
            notes: prospect.notes || '',
            lost_reason: prospect.lost_reason || '',
        });
        setIsEditing(true);
        setModalTab('dados');
        setIsModalOpen(true);
        loadActivities(prospect.id);
    };

    const loadActivities = async (prospectId: string) => {
        setIsLoadingActivities(true);
        try {
            setActivities(await prospectService.getActivities(prospectId));
        } catch (err) {
            console.error('Error fetching activities:', err);
        } finally {
            setIsLoadingActivities(false);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            notify.warning('Informe o nome do parceiro');
            return;
        }

        setIsSaving(true);
        try {
            const payload: Partial<Prospect> = {
                name: form.name.trim(),
                stage: form.stage,
                segment: form.segment || null,
                contact_name: form.contact_name || null,
                contact_role: form.contact_role || null,
                phone: form.phone || null,
                email: form.email || null,
                city: form.city || null,
                state: form.state ? form.state.toUpperCase() : null,
                source: form.source || null,
                priority: form.priority,
                estimated_value: form.estimated_value ? parseCurrency(form.estimated_value) : null,
                owner_id: form.owner_id || null,
                next_action: form.next_action || null,
                next_action_at: form.next_action_at || null,
                notes: form.notes || null,
                lost_reason: form.stage === 'perdido' ? (form.lost_reason || null) : null,
            };

            if (isEditing) {
                const before = prospects.find(p => p.id === form.id);
                const updated = await prospectService.update(form.id, payload);
                setProspects(prev => prev.map(p => (p.id === updated.id ? updated : p)));

                if (before && before.stage !== updated.stage) {
                    await prospectService.addActivity({
                        prospect_id: updated.id,
                        type: 'estagio',
                        content: `${STAGE_LABELS[before.stage]} → ${STAGE_LABELS[updated.stage]}`,
                        author_name: user?.name,
                    });
                }
                notify.success('Prospect atualizado!');
            } else {
                // Novo card entra no topo da coluna escolhida.
                const created = await prospectService.create({ ...payload, position: -1 });
                setProspects(prev => [...prev, created]);
                notify.success('Prospect criado!');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            console.error('Error saving prospect:', err);
            notify.error(err.message || 'Erro ao salvar prospect');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (prospect: Prospect) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Prospect',
            message: `Tem certeza que deseja excluir ${prospect.name}? O histórico de interações também será removido.`,
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await prospectService.delete(prospect.id);
                    setProspects(prev => prev.filter(p => p.id !== prospect.id));
                    setIsModalOpen(false);
                    notify.success('Prospect excluído!');
                } catch (err) {
                    console.error('Error deleting prospect:', err);
                    notify.error('Erro ao excluir prospect');
                }
            },
        });
    };

    const handleAddActivity = async () => {
        if (!activityForm.content.trim() || !form.id) return;
        setIsSaving(true);
        try {
            const created = await prospectService.addActivity({
                prospect_id: form.id,
                type: activityForm.type,
                content: activityForm.content.trim(),
                author_name: user?.name,
            });
            setActivities(prev => [created, ...prev]);
            setActivityForm({ type: 'nota', content: '' });
        } catch (err) {
            console.error('Error adding activity:', err);
            notify.error('Erro ao registrar interação');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteActivity = (activity: ProspectActivity) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Interação',
            message: 'Tem certeza que deseja excluir este registro do histórico?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await prospectService.deleteActivity(activity.id);
                    setActivities(prev => prev.filter(a => a.id !== activity.id));
                } catch (err) {
                    console.error('Error deleting activity:', err);
                    notify.error('Erro ao excluir interação');
                }
            },
        });
    };

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    const inputClass = 'w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm text-slate-700 dark:text-white';
    const labelClass = 'text-xs text-slate-500 font-bold mb-1.5 block ml-1';

    // Função de render (não componente): manter o mesmo nó no DOM entre renders
    // é o que faz o arrastar-e-soltar nativo sobreviver às atualizações de estado.
    const renderCard = (prospect: Prospect) => {
        const overdue = !!prospect.next_action_at && prospect.next_action_at < todayISO()
            && prospect.stage !== 'fechado' && prospect.stage !== 'perdido';
        const isDragging = draggingId === prospect.id;

        return (
            <div
                draggable
                onDragStart={(e) => {
                    setDraggingId(prospect.id);
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                onDragOver={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    const column = byStage(prospect.stage);
                    const index = column.findIndex(p => p.id === prospect.id);
                    const beforeId = after ? (column[index + 1]?.id ?? null) : prospect.id;
                    setDropTarget({ stage: prospect.stage, beforeId });
                }}
                onClick={() => openEdit(prospect)}
                className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer ${isDragging ? 'opacity-40' : ''}`}
            >
                <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{prospect.name}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border ${PRIORITY_STYLES[prospect.priority]}`}>
                        {prospect.priority}
                    </span>
                </div>

                {(prospect.segment || prospect.city) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {[prospect.segment, [prospect.city, prospect.state].filter(Boolean).join('/')].filter(Boolean).join(' • ')}
                    </p>
                )}

                {prospect.contact_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2 flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {prospect.contact_name}
                    </p>
                )}

                {prospect.estimated_value != null && Number(prospect.estimated_value) > 0 && (
                    <p className="text-sm font-black text-primary mb-2">{formatCurrency(Number(prospect.estimated_value))}</p>
                )}

                {prospect.next_action_at && (
                    <div className={`text-[11px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 mb-2 border ${overdue
                        ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40'
                        : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                        <span className="material-symbols-outlined text-[14px]">{overdue ? 'schedule' : 'event_upcoming'}</span>
                        {formatDate(prospect.next_action_at)}
                        {prospect.next_action ? ` • ${prospect.next_action}` : ''}
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                        {prospect.owner_id ? (
                            <>
                                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">
                                    {initials(ownerName(prospect.owner_id))}
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium truncate">{ownerName(prospect.owner_id) || 'Responsável'}</span>
                            </>
                        ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Sem responsável</span>
                        )}
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-primary transition-colors">drag_indicator</span>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <LoadingIndicator />
                <div className="h-32 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="w-[300px] h-96 shrink-0 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Cabeçalho + resumo */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-display">Prospecção de Parceiros</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Acompanhe cada parceiro do primeiro contato ao fechamento.</p>
                    </div>
                    <button
                        onClick={() => openCreate('novo')}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-5 rounded-2xl hover:bg-green-700 transition-all text-sm shadow-md whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        Novo Prospect
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Em prospecção', value: String(summary.open), icon: 'radar', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'Pipeline estimado', value: formatCurrency(summary.pipeline), icon: 'trending_up', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                        { label: 'Fechados', value: `${summary.won} • ${formatCurrency(summary.wonValue)}`, icon: 'verified', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                        { label: 'Ações atrasadas', value: String(summary.overdue), icon: 'schedule', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                    ].map(kpi => (
                        <div key={kpi.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                                    <span className="material-symbols-outlined text-[18px]">{kpi.icon}</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                            </div>
                            <p className="font-black text-slate-900 dark:text-white text-lg truncate">{kpi.value}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
                            placeholder="Buscar por parceiro, contato, cidade..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={ownerFilter}
                        onChange={(e) => setOwnerFilter(e.target.value)}
                        className="h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        <option value="">Todos os responsáveis</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        <option value="">Todas as prioridades</option>
                        <option value="Alta">Prioridade alta</option>
                        <option value="Média">Prioridade média</option>
                        <option value="Baixa">Prioridade baixa</option>
                    </select>
                </div>
            </div>

            {/* Kanban */}
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar items-start">
                {STAGES.map(stage => {
                    const cards = byStage(stage.key);
                    const isTargetColumn = !!draggingId && dropTarget?.stage === stage.key;

                    return (
                        <div
                            key={stage.key}
                            onDragOver={(e) => {
                                if (!draggingId) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dropTarget?.stage !== stage.key) setDropTarget({ stage: stage.key, beforeId: null });
                            }}
                            onDrop={(e) => { e.preventDefault(); handleDrop(stage.key); }}
                            className={`w-[300px] shrink-0 bg-slate-100/70 dark:bg-slate-800/40 rounded-3xl border p-3 transition-colors ${isTargetColumn
                                ? 'border-primary/60 bg-primary/5'
                                : 'border-slate-200 dark:border-slate-700/60'}`}
                        >
                            <div className="flex items-center justify-between px-2 py-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`size-2.5 rounded-full ${stage.dot} shrink-0`} />
                                    <p className={`font-bold text-sm truncate ${stage.header}`}>{stage.label}</p>
                                    <span className="text-[11px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
                                        {cards.length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => openCreate(stage.key)}
                                    title={`Adicionar em ${stage.label}`}
                                    className="p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 transition-all shrink-0"
                                >
                                    <span className="material-symbols-outlined text-[20px]">add</span>
                                </button>
                            </div>

                            {stageTotal(stage.key) > 0 && (
                                <p className="px-2 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                                    {formatCurrency(stageTotal(stage.key))}
                                </p>
                            )}

                            <div className="space-y-3 min-h-[120px] max-h-[calc(100vh-420px)] overflow-y-auto custom-scrollbar px-0.5 pb-1">
                                {cards.map(prospect => (
                                    <React.Fragment key={prospect.id}>
                                        {draggingId && dropTarget?.stage === stage.key && dropTarget.beforeId === prospect.id && (
                                            <div className="h-1 rounded-full bg-primary/60" />
                                        )}
                                        {renderCard(prospect)}
                                    </React.Fragment>
                                ))}

                                {draggingId && dropTarget?.stage === stage.key && dropTarget.beforeId === null && (
                                    <div className="h-1 rounded-full bg-primary/60" />
                                )}

                                {cards.length === 0 && (
                                    <button
                                        onClick={() => openCreate(stage.key)}
                                        className="w-full py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 font-bold text-xs hover:border-primary/50 hover:text-primary transition-all flex flex-col items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[24px]">{stage.icon}</span>
                                        Nenhum prospect aqui
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal do prospect */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start p-6 pb-4 shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white truncate">
                                    {isEditing ? form.name || 'Prospect' : 'Novo Prospect'}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    {isEditing ? STAGE_LABELS[form.stage] : 'Cadastre um parceiro para acompanhar a prospecção.'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 shrink-0">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {isEditing && (
                            <div className="px-6 shrink-0">
                                <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit border border-slate-200 dark:border-slate-700">
                                    {(['dados', 'historico'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setModalTab(tab)}
                                            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${modalTab === tab ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                            {tab === 'dados' ? 'Dados' : `Histórico${activities.length ? ` (${activities.length})` : ''}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {modalTab === 'dados' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Etapa da prospecção</label>
                                        <div className="flex flex-wrap gap-2">
                                            {STAGES.map(s => (
                                                <button
                                                    key={s.key}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, stage: s.key })}
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${form.stage === s.key
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary/40'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Nome do parceiro *</label>
                                            <input
                                                className={inputClass}
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value })}
                                                placeholder="Ex: Hospital São Lucas"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Segmento</label>
                                            <select className={inputClass} value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                                                <option value="">Selecione...</option>
                                                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Origem do contato</label>
                                            <select className={inputClass} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                                <option value="">Selecione...</option>
                                                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Cidade</label>
                                            <input className={inputClass} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ex: Recife" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>UF</label>
                                            <input
                                                className={inputClass}
                                                value={form.state}
                                                maxLength={2}
                                                onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
                                                placeholder="PE"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 mt-3">Contato</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>Nome do contato</label>
                                                <input className={inputClass} value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Ex: Dra. Ana Lima" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Cargo</label>
                                                <input className={inputClass} value={form.contact_role} onChange={e => setForm({ ...form, contact_role: e.target.value })} placeholder="Ex: Diretora Clínica" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Telefone</label>
                                                <input
                                                    className={inputClass}
                                                    value={form.phone}
                                                    onChange={e => setForm({ ...form, phone: formatPhoneMask(e.target.value) })}
                                                    placeholder="(00) 00000-0000"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>E-mail</label>
                                                <input type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contato@parceiro.com" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 mt-3">Acompanhamento</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>Responsável</label>
                                                <select className={inputClass} value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}>
                                                    <option value="">Sem responsável</option>
                                                    {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Prioridade</label>
                                                <select className={inputClass} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as ProspectPriority })}>
                                                    <option value="Alta">Alta</option>
                                                    <option value="Média">Média</option>
                                                    <option value="Baixa">Baixa</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Valor estimado (mensal)</label>
                                                <input
                                                    className={inputClass}
                                                    value={form.estimated_value}
                                                    onChange={e => {
                                                        const digits = e.target.value.replace(/\D/g, '');
                                                        setForm({
                                                            ...form,
                                                            estimated_value: digits
                                                                ? (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                                : '',
                                                        });
                                                    }}
                                                    placeholder="0,00"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Data do próximo passo</label>
                                                <input type="date" className={inputClass} value={form.next_action_at} onChange={e => setForm({ ...form, next_action_at: e.target.value })} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className={labelClass}>Próximo passo</label>
                                                <input className={inputClass} value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })} placeholder="Ex: Enviar proposta comercial" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className={labelClass}>Observações</label>
                                                <textarea
                                                    rows={3}
                                                    className={`${inputClass} h-auto py-3 resize-y`}
                                                    value={form.notes}
                                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                                    placeholder="Contexto, necessidades do parceiro, condições discutidas..."
                                                />
                                            </div>
                                            {form.stage === 'perdido' && (
                                                <div className="md:col-span-2">
                                                    <label className={labelClass}>Motivo da perda</label>
                                                    <input className={inputClass} value={form.lost_reason} onChange={e => setForm({ ...form, lost_reason: e.target.value })} placeholder="Ex: Optou por outro parceiro" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {ACTIVITY_TYPES.filter(t => t.key !== 'estagio').map(t => (
                                                <button
                                                    key={t.key}
                                                    type="button"
                                                    onClick={() => setActivityForm({ ...activityForm, type: t.key })}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${activityForm.type === t.key
                                                        ? 'bg-primary text-white border-primary'
                                                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            rows={3}
                                            className={`${inputClass} h-auto py-3 resize-y`}
                                            value={activityForm.content}
                                            onChange={e => setActivityForm({ ...activityForm, content: e.target.value })}
                                            placeholder="O que aconteceu nesse contato?"
                                        />
                                        <div className="flex justify-end mt-3">
                                            <button
                                                onClick={handleAddActivity}
                                                disabled={isSaving || !activityForm.content.trim()}
                                                className="bg-primary text-white font-bold py-2.5 px-5 rounded-xl text-sm hover:bg-primary-hover transition-colors shadow-md disabled:opacity-50"
                                            >
                                                Registrar interação
                                            </button>
                                        </div>
                                    </div>

                                    {isLoadingActivities ? (
                                        <p className="text-center text-slate-400 text-sm font-medium py-6">Carregando histórico...</p>
                                    ) : activities.length === 0 ? (
                                        <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">history</span>
                                            <p className="text-slate-500 text-sm font-medium">Nenhuma interação registrada ainda.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {activities.map(activity => {
                                                const meta = ACTIVITY_TYPES.find(t => t.key === activity.type);
                                                return (
                                                    <div key={activity.id} className="flex gap-3 group">
                                                        <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                                            <span className="material-symbols-outlined text-[18px]">{meta?.icon || 'sticky_note_2'}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3 border border-slate-200 dark:border-slate-700">
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">
                                                                    {meta?.label || activity.type}
                                                                    {activity.author_name ? ` • ${activity.author_name}` : ''}
                                                                </p>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                                        {new Date(activity.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleDeleteActivity(activity)}
                                                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                                                                        title="Excluir"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{activity.content}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                            {isEditing ? (
                                <button
                                    onClick={() => {
                                        const prospect = prospects.find(p => p.id === form.id);
                                        if (prospect) handleDelete(prospect);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 text-sm font-bold transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span> Excluir
                                </button>
                            ) : <span />}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-green-700 transition-colors shadow-md disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : (isEditing ? 'Salvar alterações' : 'Criar prospect')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />
        </div>
    );
};

export default Prospects;
