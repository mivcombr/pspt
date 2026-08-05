import React, { useState, useMemo, useEffect } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { APP_TIME_ZONE, formatCurrency, formatNumber, formatCurrencyNoDecimals, formatDate } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { useAuth } from '../contexts/AuthContext';

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const PercentageBadge = ({ current, previous, className = "" }: { current: number, previous: number, className?: string }) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 0.1) return null;

    const isPositive = change > 0;
    const valueStr = Math.abs(change).toFixed(1).replace('.', ',') + '%';

    return (
        <div className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-lg shrink-0 ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'} ${className}`}>
            <span className="material-symbols-outlined text-[12px] sm:text-[14px] leading-none" style={{ fontVariationSettings: "'FILL' 0, 'wght' 700, 'GRAD' 0, 'opsz' 20" }}>{isPositive ? 'trending_up' : 'trending_down'}</span>
            <span>{valueStr}</span>
        </div>
    );
};

// --- Métricas de agendamento ---
const EMPTY_BUCKET = { agendado: 0, atendido: 0, falhou: 0, total: 0, revenue: 0 };

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    COMMERCIAL: 'Comercial',
    OUTROS: 'Recepção / Financeiro'
};

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const isFullMonthRange = (start: Date, end: Date) =>
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();

// Rótulo amigável: "Agosto de 2026" quando o intervalo é um mês fechado,
// senão o intervalo completo em dd/mm/aaaa.
const describeRange = (start: Date, end: Date) =>
    isFullMonthRange(start, end)
        ? `${MONTH_NAMES[start.getMonth()]} de ${start.getFullYear()}`
        : `${formatDate(start)} – ${formatDate(end)}`;

const getInitials = (name: string) =>
    (name || '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('') || '?';

const WHATSAPP_CONTACTS = [
    { city: 'Natal', phone: '(84) 9 9963-4081' },
    { city: 'Fortaleza', phone: '(85) 99190-1038' },
    { city: 'Teresina', phone: '(86) 99499-1590' },
];

const buildWhatsAppMessage = (phone: string) =>
    `Você pode entrar em contato com a gente pelo whatsapp ${phone} para saber mais.`;

const WhatsAppContacts: React.FC = () => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(current => (current === key ? null : current)), 2000);
    };

    return (
        <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 border border-green-100 dark:border-green-900/30 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">chat</span>
                </span>
                <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest">WhatsApp por Cidade</h3>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Copie o número ou a mensagem pronta para envio.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {WHATSAPP_CONTACTS.map(({ city, phone }) => (
                    <div key={city} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 sm:p-4 min-w-0">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{city}</p>
                        <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 truncate">{phone}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <button
                                onClick={() => copyToClipboard(`${city}-phone`, phone)}
                                className={`flex-1 min-w-0 basis-24 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-bold transition-all ${copiedKey === `${city}-phone` ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary'}`}
                            >
                                <span className="material-symbols-outlined text-[14px] shrink-0">{copiedKey === `${city}-phone` ? 'check' : 'content_copy'}</span>
                                <span className="truncate">{copiedKey === `${city}-phone` ? 'Copiado!' : 'Número'}</span>
                            </button>
                            <button
                                onClick={() => copyToClipboard(`${city}-message`, buildWhatsAppMessage(phone))}
                                className={`flex-1 min-w-0 basis-24 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-bold transition-all ${copiedKey === `${city}-message` ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary'}`}
                            >
                                <span className="material-symbols-outlined text-[14px] shrink-0">{copiedKey === `${city}-message` ? 'check' : 'sms'}</span>
                                <span className="truncate">{copiedKey === `${city}-message` ? 'Copiado!' : 'Mensagem'}</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
        (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '' : (user?.hospitalId || '')
    );

    const [hospitals, setHospitals] = useState<any[]>([]);
    const [dashboardData, setDashboardData] = useState<any>({
        chartData: [],
        totals: { revenue: 0, repasse: 0, hospital: 0, expenses: 0, consultas: 0, exames: 0, cirurgias: 0 },
        prevTotals: { revenue: 0, repasse: 0, hospital: 0, expenses: 0, consultas: 0, exames: 0, cirurgias: 0 },
        partnerBreakdown: []
    });
    const [schedulingData, setSchedulingData] = useState<any>({
        byType: { CONSULTA: null, CIRURGIA: null },
        prevByType: { CONSULTA: null, CIRURGIA: null },
        sellers: [],
        others: null,
        period: null
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeDateFilter, setActiveDateFilter] = useState('Este Mês');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    // Default to current month
    const [tempStartDate, setTempStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [tempEndDate, setTempEndDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

    useEffect(() => {
        const fetchHospitals = async () => {
            if ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN')) {
                try {
                    const data = await hospitalService.getAll();
                    setHospitals(data || []);
                } catch (err) {
                    console.error('Error fetching hospitals:', err);
                }
            }
        };
        fetchHospitals();
    }, [user?.role]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!tempStartDate || !tempEndDate) return;

            setIsLoading(true);
            setError(null);
            try {
                const startDateStr = tempStartDate.toISOString().split('T')[0];
                const endDateStr = tempEndDate.toISOString().split('T')[0];

                // If the range is "Este Ano", we use the full year but the chart is already logic-based
                // However, for the KPIs, we follow the selected filters exactly
                const [data, scheduling] = await Promise.all([
                    appointmentService.getDashboardData({
                        startDate: startDateStr,
                        endDate: endDateStr,
                        hospitalId: selectedHospitalId || undefined
                    }),
                    appointmentService.getSchedulingMetrics({
                        startDate: startDateStr,
                        endDate: endDateStr,
                        hospitalId: selectedHospitalId || undefined
                    })
                ]);
                setDashboardData(data);
                setSchedulingData(scheduling);
            } catch (err: any) {
                console.error('Error fetching dashboard data:', err);
                setError('Erro ao carregar dados do servidor.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [selectedHospitalId, tempStartDate, tempEndDate]);

    // --- Calendar Logic ---
    const handleCalendarNav = (direction: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setViewDate(newDate);
    };

    const handleDayClick = (day: number) => {
        const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

        if (!tempStartDate || (tempStartDate && tempEndDate)) {
            setTempStartDate(clickedDate);
            setTempEndDate(null);
        } else {
            if (clickedDate < tempStartDate) {
                setTempEndDate(tempStartDate);
                setTempStartDate(clickedDate);
            } else {
                setTempEndDate(clickedDate);
            }
        }
    };

    const isSelected = (day: number) => {
        if (!tempStartDate) return false;
        const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        if (current.getTime() === tempStartDate.getTime()) return true;
        if (tempEndDate && current.getTime() === tempEndDate.getTime()) return true;
        if (tempEndDate && current > tempStartDate && current < tempEndDate) return true;
        return false;
    };

    const isRangeStart = (day: number) => {
        if (!tempStartDate) return false;
        const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        return current.getTime() === tempStartDate.getTime();
    };

    const isRangeEnd = (day: number) => {
        if (!tempEndDate) return false;
        const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        return current.getTime() === tempEndDate.getTime();
    };

    const isRangeMiddle = (day: number) => {
        if (!tempStartDate || !tempEndDate) return false;
        const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        return current > tempStartDate && current < tempEndDate;
    };

    const formatRangeLabel = () => {
        if (!tempStartDate) return 'Selecione uma data';
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
        const start = tempStartDate.toLocaleDateString('pt-BR', { ...options, timeZone: APP_TIME_ZONE });
        if (tempEndDate) {
            const end = tempEndDate.toLocaleDateString('pt-BR', { ...options, timeZone: APP_TIME_ZONE });
            return `${start} - ${end}`;
        }
        return start;
    };

    const applyPreset = (preset: string) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'Hoje':
                break;
            case 'Ontem':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'Hoje e ontem':
                start.setDate(today.getDate() - 1);
                break;
            case 'Últimos 7 dias':
                start.setDate(today.getDate() - 6);
                break;
            case 'Últimos 14 dias':
                start.setDate(today.getDate() - 13);
                break;
            case 'Últimos 28 dias':
                start.setDate(today.getDate() - 27);
                break;
            case 'Últimos 30 dias':
                start.setDate(today.getDate() - 29);
                break;
            case 'Esta semana':
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                end.setDate(diff + 6);
                break;
            case 'Semana passada':
                const prevWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
                const pDay = prevWeek.getDay();
                const pDiff = prevWeek.getDate() - pDay + (pDay === 0 ? -6 : 1);
                start = new Date(prevWeek.setDate(pDiff));
                end = new Date(prevWeek);
                end.setDate(start.getDate() + 6);
                break;
            case 'Este mês':
            case 'Este Mês':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'Mês passado':
            case 'Mês Passado':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'Este Ano':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
        }
        setTempStartDate(start);
        setTempEndDate(end);
        setViewDate(end);
        setActiveDateFilter(preset);
        setIsCalendarOpen(false);
    };

    // Navegação por mês fechado: permite chegar a qualquer mês passado sem
    // depender do calendário personalizado.
    const applyMonth = (year: number, month: number) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        const today = new Date();
        const prevRef = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        setTempStartDate(start);
        setTempEndDate(end);
        setViewDate(end);
        setIsCalendarOpen(false);

        if (start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()) {
            setActiveDateFilter('Este Mês');
        } else if (start.getFullYear() === prevRef.getFullYear() && start.getMonth() === prevRef.getMonth()) {
            setActiveDateFilter('Mês Passado');
        } else {
            setActiveDateFilter('Mês');
        }
    };

    const shiftMonth = (delta: number) => {
        const base = tempStartDate || new Date();
        applyMonth(base.getFullYear(), base.getMonth() + delta);
    };

    const monthStepperLabel = useMemo(() => {
        const base = tempStartDate || new Date();
        return `${MONTH_SHORT[base.getMonth()]} ${base.getFullYear()}`;
    }, [tempStartDate]);

    const periodLabel = useMemo(() => {
        if (!tempStartDate || !tempEndDate) return '';
        return describeRange(tempStartDate, tempEndDate);
    }, [tempStartDate, tempEndDate]);

    // O período de comparação vem do próprio serviço, para o rótulo não divergir
    // do cálculo usado nos indicadores.
    const comparisonLabel = useMemo(() => {
        const period = schedulingData?.period;
        if (!period?.prevStart || !period?.prevEnd) return '';
        return describeRange(new Date(period.prevStart + 'T00:00:00'), new Date(period.prevEnd + 'T00:00:00'));
    }, [schedulingData?.period]);

    const sortedByRevenue = useMemo(() => {
        return [...(dashboardData?.partnerBreakdown || [])].sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
    }, [dashboardData?.partnerBreakdown]);

    const sortedByRepasse = useMemo(() => {
        return [...(dashboardData?.partnerBreakdown || [])].sort((a: any, b: any) => b.totalRepasse - a.totalRepasse);
    }, [dashboardData?.partnerBreakdown]);

    // Vendedores ordenados por faturamento realizado, com a linha agregada dos
    // demais perfis sempre por último para o total da tabela fechar.
    const sellerRows = useMemo(() => {
        const rows = [...(schedulingData?.sellers || [])];
        if (schedulingData?.others) rows.push(schedulingData.others);
        return rows;
    }, [schedulingData?.sellers, schedulingData?.others]);

    const sellerTotals = useMemo(() => {
        const acc = {
            consultas: { agendado: 0, atendido: 0, falhou: 0 },
            cirurgias: { agendado: 0, atendido: 0, falhou: 0 },
            revenue: 0,
            prevRevenue: 0
        };
        sellerRows.forEach((s: any) => {
            (['agendado', 'atendido', 'falhou'] as const).forEach(status => {
                acc.consultas[status] += s.consultas[status];
                acc.cirurgias[status] += s.cirurgias[status];
            });
            acc.revenue += s.revenue;
            acc.prevRevenue += s.prevRevenue;
        });
        return acc;
    }, [sellerRows]);

    return (
        <div className="max-w-screen-xl w-full mx-auto space-y-5 sm:space-y-6 relative pb-8 px-4 sm:px-6">

            {/* Header & Filters */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 sm:gap-6 pb-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/5 text-primary border border-primary/10 text-xs font-black uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                            {periodLabel}
                        </span>
                        {comparisonLabel && (
                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                                comparado com {comparisonLabel}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center flex-wrap w-full xl:w-auto">
                    {isLoading && <LoadingIndicator />}
                    {/* Hospital Select (Admin only) */}
                    {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? (
                        <div className="relative w-full sm:w-auto">
                            <select
                                value={selectedHospitalId}
                                onChange={(e) => setSelectedHospitalId(e.target.value)}
                                className="appearance-none bg-white dark:bg-slate-900 border-none text-slate-700 dark:text-slate-200 py-2.5 pl-5 pr-12 rounded-lg font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm card-shadow w-full sm:w-64 cursor-pointer"
                            >
                                <option value="">Todos os Hospitais</option>
                                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">expand_more</span>
                        </div>
                    ) : (
                        <div className="px-4 py-2.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-2 w-full sm:w-auto">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{user?.hospitalName}</span>
                        </div>
                    )}

                    {/* Navegação mês a mês */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 card-shadow w-full sm:w-auto justify-center shrink-0">
                        <button
                            onClick={() => shiftMonth(-1)}
                            aria-label="Mês anterior"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <span className="px-2 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap min-w-[84px] text-center tabular-nums">
                            {monthStepperLabel}
                        </span>
                        <button
                            onClick={() => shiftMonth(1)}
                            aria-label="Próximo mês"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>

                    {/* Date Filters (Same as Expenses) */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto overflow-x-auto sm:overflow-visible">
                        {['Este Mês', 'Mês Passado', 'Este Ano'].map(preset => (
                            <button
                                key={preset}
                                onClick={() => applyPreset(preset)}
                                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeDateFilter === preset ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                {preset}
                            </button>
                        ))}

                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>

                        <button
                            onClick={() => setIsCalendarOpen(true)}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeDateFilter === 'Personalizado' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                {activeDateFilter === 'Personalizado' ? formatRangeLabel() : 'Personalizado'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Row 1: Agendamentos por tipo (Consultas e Cirurgias) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-44 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200 dark:border-slate-700" />
                    ))
                ) : (
                    [
                        { key: 'CONSULTA', title: 'Consultas', icon: 'event_note' },
                        { key: 'CIRURGIA', title: 'Cirurgias', icon: 'medical_services' }
                    ].map((item, i) => {
                        const curr = schedulingData.byType?.[item.key] || EMPTY_BUCKET;
                        const prev = schedulingData.prevByType?.[item.key] || EMPTY_BUCKET;

                        return (
                            <div
                                key={item.key}
                                className={`bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 card-shadow border border-slate-200 dark:border-slate-700 card-hover transition-all duration-300 animate-card-entrance stagger-${i + 1}`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50 shrink-0">
                                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest truncate">{item.title}</h4>
                                            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                {formatNumber(curr.total)} agendamentos no período
                                            </p>
                                        </div>
                                    </div>
                                    <PercentageBadge current={curr.total} previous={prev.total} />
                                </div>

                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    {[
                                        { label: 'Agendado', value: curr.agendado, prevValue: prev.agendado, tone: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/70 dark:bg-blue-500/10' },
                                        { label: 'Realizado', value: curr.atendido, prevValue: prev.atendido, tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/70 dark:bg-emerald-500/10' },
                                        { label: 'Falhou', value: curr.falhou, prevValue: prev.falhou, tone: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50/70 dark:bg-rose-500/10' }
                                    ].map(status => (
                                        <div key={status.label} className={`rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50 ${status.bg}`}>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 truncate">{status.label}</p>
                                            <p className={`font-black text-xl leading-none font-display tabular-nums ${status.tone}`}>{formatNumber(status.value)}</p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 tabular-nums">
                                                {formatNumber(status.prevValue)} no anterior
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-end justify-between border-t border-slate-100 dark:border-slate-800 mt-4 pt-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Faturamento realizado</p>
                                        <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-none font-display">{formatCurrency(curr.revenue)}</p>
                                    </div>
                                    <PercentageBadge current={curr.revenue} previous={prev.revenue} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Row 2: Agendamentos por vendedor */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">badge</span>
                            Agendamentos por vendedor
                        </h3>
                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
                            Consultas e cirurgias por quem registrou o agendamento (perfis Admin e Comercial). Valor em R$ considera apenas os realizados.
                        </p>
                    </div>
                    {comparisonLabel && (
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                            {periodLabel} vs. {comparisonLabel}
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-4 sm:p-6 space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                        ))}
                    </div>
                ) : sellerRows.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Nenhum agendamento de consulta ou cirurgia no período.</p>
                    </div>
                ) : (
                    <>
                        {/* Tabela (telas médias e maiores) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[860px]">
                                <thead>
                                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                                        <th rowSpan={2} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 align-bottom">Vendedor</th>
                                        <th colSpan={3} className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-700">Consultas</th>
                                        <th colSpan={3} className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-700">Cirurgias</th>
                                        <th rowSpan={2} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 align-bottom border-l border-slate-200 dark:border-slate-700">R$ realizado</th>
                                    </tr>
                                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                                        {['Agend.', 'Realiz.', 'Falhou', 'Agend.', 'Realiz.', 'Falhou'].map((label, idx) => (
                                            <th
                                                key={`${label}-${idx}`}
                                                className={`px-3 pb-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${idx % 3 === 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''}`}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sellerRows.map((s: any) => (
                                        <tr
                                            key={s.id}
                                            className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${s.isSeller ? '' : 'bg-slate-50/40 dark:bg-slate-800/20'}`}
                                        >
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3 min-w-0 max-w-[260px]">
                                                    <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[11px] font-black text-slate-600 dark:text-slate-300 shrink-0">
                                                        {getInitials(s.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{s.name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{ROLE_LABELS[s.role] || s.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {[s.consultas, s.cirurgias].map((bucket: any, bIdx: number) => (
                                                <React.Fragment key={bIdx}>
                                                    <td className="px-3 py-3 text-center text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums border-l border-slate-100 dark:border-slate-800">{formatNumber(bucket.agendado)}</td>
                                                    <td className="px-3 py-3 text-center text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatNumber(bucket.atendido)}</td>
                                                    <td className="px-3 py-3 text-center text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatNumber(bucket.falhou)}</td>
                                                </React.Fragment>
                                            ))}
                                            <td className="px-4 py-3 text-right border-l border-slate-100 dark:border-slate-800">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="font-black text-slate-900 dark:text-white text-sm tabular-nums">{formatCurrency(s.revenue)}</span>
                                                    <PercentageBadge current={s.revenue} previous={s.prevRevenue} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40">
                                        <td className="px-5 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</td>
                                        {[sellerTotals.consultas, sellerTotals.cirurgias].map((bucket: any, bIdx: number) => (
                                            <React.Fragment key={bIdx}>
                                                <td className="px-3 py-3 text-center text-sm font-black text-slate-700 dark:text-slate-300 tabular-nums border-l border-slate-200 dark:border-slate-700">{formatNumber(bucket.agendado)}</td>
                                                <td className="px-3 py-3 text-center text-sm font-black text-slate-700 dark:text-slate-300 tabular-nums">{formatNumber(bucket.atendido)}</td>
                                                <td className="px-3 py-3 text-center text-sm font-black text-slate-700 dark:text-slate-300 tabular-nums">{formatNumber(bucket.falhou)}</td>
                                            </React.Fragment>
                                        ))}
                                        <td className="px-4 py-3 text-right border-l border-slate-200 dark:border-slate-700">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-black text-slate-900 dark:text-white text-sm tabular-nums">{formatCurrency(sellerTotals.revenue)}</span>
                                                <PercentageBadge current={sellerTotals.revenue} previous={sellerTotals.prevRevenue} />
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Cards (mobile) */}
                        <div className="md:hidden p-4 space-y-3 bg-slate-50/30 dark:bg-slate-900/50">
                            {sellerRows.map((s: any) => (
                                <div key={s.id} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[11px] font-black text-slate-600 dark:text-slate-300 shrink-0">
                                                {getInitials(s.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{s.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{ROLE_LABELS[s.role] || s.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className="font-black text-slate-900 dark:text-white text-sm tabular-nums">{formatCurrency(s.revenue)}</span>
                                            <PercentageBadge current={s.revenue} previous={s.prevRevenue} className="mt-0.5" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[{ label: 'Consultas', bucket: s.consultas }, { label: 'Cirurgias', bucket: s.cirurgias }].map(col => (
                                            <div key={col.label} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50 p-2.5">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">{col.label}</p>
                                                <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
                                                    <span className="text-blue-600 dark:text-blue-400">{formatNumber(col.bucket.agendado)} ag.</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400">{formatNumber(col.bucket.atendido)} rl.</span>
                                                    <span className="text-rose-600 dark:text-rose-400">{formatNumber(col.bucket.falhou)} fl.</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Row 4: Lists Blocks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {/* List 1: Faturamento */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                            Faturamento por Parceiro
                        </h3>
                    </div>
                    {!isLoading && sortedByRevenue.length > 0 && (
                        <div className="h-64 px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sortedByRevenue} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
                                    <XAxis type="number" tickFormatter={(value) => formatCurrencyNoDecimals(value)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="code" type="category" width={80} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalRevenue" fill="#B92926" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    <div className="p-4 sm:p-6 space-y-3 bg-slate-50/30 dark:bg-slate-900/50 flex-1">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 animate-pulse" />
                            ))
                        ) : (
                            sortedByRevenue.map((p: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0`}>
                                            {p.code}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{p.name}</p>
                                            <p className="text-xs text-slate-500 font-medium truncate">{p.location}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 pl-2">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                                                {formatCurrency(p.totalRevenue)}
                                            </span>
                                            <PercentageBadge current={p.totalRevenue} previous={p.totalRevenuePrev} className="mt-0.5" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* List 2: Repasse */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">payments</span>
                            Repasse ao programa por Parceiro
                        </h3>
                    </div>
                    {!isLoading && sortedByRepasse.length > 0 && (
                        <div className="h-64 px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sortedByRepasse} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
                                    <XAxis type="number" tickFormatter={(value) => formatCurrencyNoDecimals(value)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="code" type="category" width={80} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalRepasse" fill="#B92926" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    <div className="p-4 sm:p-6 space-y-3 bg-slate-50/30 dark:bg-slate-900/50 flex-1">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 animate-pulse" />
                            ))
                        ) : (
                            sortedByRepasse.map((p: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0`}>
                                            {p.code}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{p.name}</p>
                                            <p className="text-xs text-slate-500 font-medium truncate">{p.location}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 pl-2">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                                                {formatCurrency(p.totalRepasse)}
                                            </span>
                                            <PercentageBadge current={p.totalRepasse} previous={p.totalRepassePrev} className="mt-0.5" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* WhatsApp Contacts (Admin only) */}
            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && <WhatsAppContacts />}

            {/* --- CUSTOM CALENDAR MODAL --- */}
            {isCalendarOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex border border-slate-200 dark:border-slate-700 h-[500px]">

                        {/* Left Sidebar: Presets */}
                        <div className="w-64 bg-slate-50/80 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-2 overflow-y-auto">
                            {['Hoje', 'Ontem', 'Hoje e ontem', 'Últimos 7 dias', 'Últimos 14 dias', 'Últimos 28 dias', 'Últimos 30 dias', 'Esta semana', 'Semana passada', 'Este mês', 'Mês passado'].map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => applyPreset(preset)}
                                    className="text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        {/* Right Side: Calendar & Actions */}
                        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">

                            {/* Calendar Header */}
                            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleCalendarNav(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">
                                        {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: APP_TIME_ZONE })}
                                    </span>
                                    <button onClick={() => handleCalendarNav(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>

                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Intervalo Selecionado</p>
                                    <p className="text-sm font-bold text-primary dark:text-primary-hover">{formatRangeLabel()}</p>
                                </div>

                                <button onClick={() => setIsCalendarOpen(false)} className="text-slate-400 hover:text-slate-600 ml-4">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="flex-1 p-8 overflow-y-auto">
                                <div className="grid grid-cols-7 mb-4">
                                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
                                        <div key={i} className={`text-center text-xs font-bold uppercase tracking-widest ${i === 0 || i === 6 ? 'text-primary opacity-60' : 'text-slate-400'}`}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-y-2 gap-x-0">
                                    {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                                        <div key={`empty-${i}`} />
                                    ))}
                                    {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                                        const day = i + 1;
                                        const isStart = isRangeStart(day);
                                        const isEnd = isRangeEnd(day);
                                        const isMiddle = isRangeMiddle(day);
                                        const selected = isSelected(day);

                                        return (
                                            <div key={day} className="relative h-10 flex items-center justify-center">
                                                {/* Background Strip for Range */}
                                                {isMiddle && <div className="absolute inset-x-0 top-1 bottom-1 bg-red-50 dark:bg-primary/10"></div>}
                                                {isStart && tempEndDate && <div className="absolute left-1/2 right-0 top-1 bottom-1 bg-red-50 dark:bg-primary/10 rounded-l-md"></div>}
                                                {isEnd && tempStartDate && <div className="absolute left-0 right-1/2 top-1 bottom-1 bg-red-50 dark:bg-primary/10 rounded-r-md"></div>}

                                                <button
                                                    onClick={() => handleDayClick(day)}
                                                    className={`
                                                relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all
                                                ${selected && !isMiddle ? 'bg-primary text-white shadow-lg shadow-primary/30 transform scale-105' : ''}
                                                ${!selected && !isMiddle ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : ''}
                                                ${isMiddle ? 'text-primary dark:text-primary-hover bg-red-50 dark:bg-primary/10 rounded-none w-full' : ''}
                                            `}
                                                >
                                                    {day}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-400 uppercase mr-4">America/Recife (GMT-03:00)</span>
                                    <button
                                        onClick={() => setIsCalendarOpen(false)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveDateFilter('Personalizado');
                                            setIsCalendarOpen(false);
                                        }}
                                        className="px-8 py-2.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all transform active:scale-95"
                                    >
                                        ATUALIZAR
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
