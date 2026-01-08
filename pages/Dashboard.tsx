import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { formatCurrency, formatNumber, formatCurrencyNoDecimals } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { useAuth } from '../contexts/AuthContext';

const renderCustomLabel = (props: any) => {
    const { x, y, value, stroke } = props;
    if (value === 0) return null;
    return (
        <text x={x} y={y} dy={-10} fill={stroke} fontSize={10} textAnchor="middle" fontWeight="bold">
            {formatCurrencyNoDecimals(value)}
        </text>
    );
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
        user?.role === 'ADMIN' ? '' : (user?.hospitalId || '')
    );
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    const [hospitals, setHospitals] = useState<any[]>([]);
    const [dashboardData, setDashboardData] = useState<any>({
        chartData: [],
        totals: { revenue: 0, repasse: 0, consultas: 0, exames: 0, cirurgias: 0 },
        partnerBreakdown: []
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
            if (user?.role === 'ADMIN') {
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
                const data = await appointmentService.getDashboardData({
                    startDate: startDateStr,
                    endDate: endDateStr,
                    hospitalId: selectedHospitalId || undefined
                });
                setDashboardData(data);
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
        const start = tempStartDate.toLocaleDateString('pt-BR', options);
        if (tempEndDate) {
            const end = tempEndDate.toLocaleDateString('pt-BR', options);
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
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'Mês passado':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
        }
        setTempStartDate(start);
        setTempEndDate(end);
        setViewDate(end);
        setActiveDateFilter(preset);
        setIsCalendarOpen(false);
    };

    return (
        <div className="max-w-screen-xl w-full mx-auto space-y-6 relative pb-8 px-4 sm:px-6">

            {/* Header & Filters */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Visão consolidada financeira e operacional.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center flex-wrap">
                    {/* Hospital Select (Admin only) */}
                    {user?.role === 'ADMIN' ? (
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
                        <div className="px-5 py-2.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{user?.hospitalName}</span>
                        </div>
                    )}

                    {/* Date Filters (Pill Style) */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => applyPreset('Este mês')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeDateFilter === 'Este mês' ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        >
                            Este Mês
                        </button>

                        <button
                            onClick={() => setActiveDateFilter('Este Mês')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${activeDateFilter === 'Este Mês' ? 'bg-red-50 text-primary border border-red-100 dark:bg-primary/20 dark:text-primary-hover dark:border-primary/30' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                            Este Mês <span className="material-symbols-outlined text-[18px]">expand_more</span>
                        </button>

                        <button
                            onClick={() => setActiveDateFilter('Hoje')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeDateFilter === 'Hoje' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        >
                            Hoje
                        </button>

                        <button
                            onClick={() => setActiveDateFilter('Últimos 7 dias')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeDateFilter === 'Últimos 7 dias' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        >
                            Últimos 7 dias
                        </button>

                        <button
                            onClick={() => setIsCalendarOpen(true)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeDateFilter === 'Personalizado' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        >
                            Personalizado
                        </button>
                    </div>
                </div>
            </div>

            {/* Row 1: Big KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <Card className="flex flex-wrap md:flex-nowrap items-start gap-3 sm:gap-4 p-5 relative overflow-hidden group min-h-[110px]">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-primary-hover shrink-0">
                        <span className="material-symbols-outlined text-[24px]">attach_money</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Faturamento Total ({activeDateFilter === 'Personalizado' ? formatRangeLabel() : activeDateFilter})</p>
                        <h3 className="text-[clamp(1.25rem,4vw,1.875rem)] font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 animate-in fade-in duration-500 leading-tight whitespace-normal break-words">
                            {formatCurrencyNoDecimals(dashboardData.totals.revenue)}
                        </h3>
                    </div>
                </Card>

                <Card className="flex flex-wrap md:flex-nowrap items-start gap-3 sm:gap-4 p-5 relative overflow-hidden group min-h-[110px]">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-primary-hover shrink-0">
                        <span className="material-symbols-outlined text-[24px]">payments</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Valor de Repasse ({activeDateFilter === 'Personalizado' ? formatRangeLabel() : activeDateFilter})</p>
                        <h3 className="text-[clamp(1.25rem,4vw,1.875rem)] font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 animate-in fade-in duration-500 leading-tight whitespace-normal break-words">
                            {formatCurrencyNoDecimals(dashboardData.totals.repasse)}
                        </h3>
                    </div>
                </Card>
            </div>

            {/* Row 2: Detailed Service KPIs - CLEAN STYLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {[
                    { title: 'Consultas', count: dashboardData.totals.consultas, value: formatCurrency(dashboardData.totals.consultas_revenue || 0), icon: 'event_note' },
                    { title: 'Exames', count: dashboardData.totals.exames, value: formatCurrency(dashboardData.totals.exames_revenue || 0), icon: 'biotech' },
                    { title: 'Cirurgias', count: dashboardData.totals.cirurgias, value: formatCurrency(dashboardData.totals.cirurgias_revenue || 0), icon: 'medical_services' }
                ].map((item, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-5 card-shadow border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap min-w-0">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-primary-hover shrink-0">
                                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                            </div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight whitespace-normal">
                                {item.title} <span className="font-normal opacity-70">({formatNumber(item.count)})</span>
                            </p>
                        </div>
                        <h3 className="text-[clamp(1.125rem,3.2vw,1.5rem)] font-extrabold text-slate-900 dark:text-white tracking-tight animate-in fade-in leading-tight whitespace-normal break-words">
                            {item.value}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Row 3: Chart & Summary Block */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden flex flex-col">

                {/* Block Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">monitoring</span>
                            Evolução da Receita
                        </h3>
                        <div className="flex gap-4 mt-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-white"></span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Faturamento</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Repasse</span>
                            </div>
                        </div>
                    </div>

                    {/* Year Selector */}
                    <div className="relative">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="appearance-none bg-slate-50 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-200 py-2 pl-4 pr-10 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                            <option value="2022">2022</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
                    </div>
                </div>

                {/* Block Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12">
                    <div className="lg:col-span-8 p-6 h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardData.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                                    dy={15}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                    tickFormatter={(value) => formatCurrencyNoDecimals(value)}
                                />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px 16px' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#0f172a"
                                    strokeWidth={4}
                                    dot={false}
                                    activeDot={{ r: 8, fill: '#0f172a', strokeWidth: 0 }}
                                    animationDuration={500}
                                >
                                    <LabelList content={renderCustomLabel} />
                                </Line>
                                <Line
                                    type="monotone"
                                    dataKey="repasse"
                                    stroke="#B92926"
                                    strokeWidth={4}
                                    dot={false}
                                    activeDot={{ r: 8, fill: '#B92926', strokeWidth: 0 }}
                                    animationDuration={500}
                                >
                                    <LabelList content={renderCustomLabel} />
                                </Line>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 p-8 flex flex-col justify-center space-y-8 lg:space-y-10 bg-slate-50/30 dark:bg-slate-800/20">
                        <div className="min-w-0">
                            <span className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-500 mb-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1 truncate">Total Faturado</p>
                            <h4 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight animate-in fade-in truncate">
                                {formatCurrency(dashboardData.totals.revenue)}
                            </h4>
                        </div>
                        <div className="min-w-0">
                            <span className="inline-flex items-center justify-center p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-primary mb-3 border border-red-100 dark:border-red-900/30 shadow-sm">
                                <span className="material-symbols-outlined text-[20px]">outbound</span>
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1 truncate">Total Repassado</p>
                            <h4 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight animate-in fade-in truncate">
                                {formatCurrency(dashboardData.totals.repasse)}
                            </h4>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 4: Lists Blocks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* List 1: Faturamento */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                            Faturamento por Parceiro
                        </h3>
                    </div>
                    <div className="p-6 space-y-3 bg-slate-50/30 dark:bg-slate-900/50 flex-1">
                        {dashboardData.partnerBreakdown.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 hover:shadow-md transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300`}>
                                        {p.code}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                                        <p className="text-xs text-slate-500 font-medium">{p.location}</p>
                                    </div>
                                </div>
                                <span className="font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-700/50 px-3 py-1 rounded-lg text-sm">
                                    {formatCurrency(p.totalRevenue)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* List 2: Repasse */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">payments</span>
                            Repasse por Parceiro
                        </h3>
                    </div>
                    <div className="p-6 space-y-3 bg-slate-50/30 dark:bg-slate-900/50 flex-1">
                        {dashboardData.partnerBreakdown.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 hover:shadow-md transition-all duration-300">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                                    <p className="text-xs text-slate-500 font-medium">{p.location}</p>
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {formatCurrency(p.totalRepasse)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

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
                                        {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
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
