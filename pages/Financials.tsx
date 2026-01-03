import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { formatCurrency, formatDate } from '../utils/formatters';

const ITEMS_PER_PAGE = 10;

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const Financials: React.FC = () => {
    const { user } = useAuth();
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedHospital, setSelectedHospital] = useState('Todos os Hospitais');
    const [hospitals, setHospitals] = useState<any[]>([]);

    const [activeDateFilter, setActiveDateFilter] = useState('Este Mês');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [viewDate, setViewDate] = useState(new Date());
    const [tempStartDate, setTempStartDate] = useState<Date | null>(new Date());
    const [tempEndDate, setTempEndDate] = useState<Date | null>(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const [appointments, setAppointments] = useState<any[]>([]);
    const [totals, setTotals] = useState({ revenue: 0, repasse: 0, hospital: 0, pending: 0, pendingRepasse: 0 });

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        id: '',
        patient_name: '',
        total_cost: '',
        repasse_value: '',
        hospital_value: '',
        payment_status: '',
        repasse_status: ''
    });

    const [categoryTotals, setCategoryTotals] = useState({
        exames: { value: 0, pct: '0%' },
        cirurgias: { value: 0, pct: '0%' },
        consultas: { value: 0, pct: '0%' }
    });
    const [isLoading, setIsLoading] = useState(true);

    const formatDateForInput = (date: Date | null) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hospitalArr = await hospitalService.getAll();
            setHospitals(hospitalArr);

            const filters: any = {};
            if (user?.role === UserRole.ADMIN) {
                if (selectedHospital !== 'Todos os Hospitais') {
                    const hosp = hospitalArr.find(h => h.name === selectedHospital);
                    if (hosp) filters.hospitalId = hosp.id;
                }
            } else {
                filters.hospitalId = user?.hospitalId;
            }

            if (tempStartDate && tempEndDate) {
                filters.startDate = formatDateForInput(tempStartDate);
                filters.endDate = formatDateForInput(tempEndDate);
            }

            const data = await appointmentService.getAll(filters);
            setAppointments(data);

            const stats = data.reduce((acc, curr) => {
                const cost = Number(curr.total_cost);
                acc.revenue += cost;
                acc.repasse += Number(curr.repasse_value);
                acc.hospital += Number(curr.hospital_value);
                if (curr.payment_status === 'Pendente') acc.pending += cost;

                // Track Pending Repasse (default to Pendente if null)
                if (curr.repasse_status === 'Pendente' || !curr.repasse_status) acc.pendingRepasse += Number(curr.repasse_value);

                if (curr.type === 'EXAME') acc.exames += cost;
                else if (curr.type === 'CIRURGIA') acc.cirurgias += cost;
                else if (curr.type === 'CONSULTA') acc.consultas += cost;

                return acc;
            }, { revenue: 0, repasse: 0, hospital: 0, pending: 0, pendingRepasse: 0, exames: 0, cirurgias: 0, consultas: 0 });

            setTotals(stats);
            setCategoryTotals({
                exames: { value: stats.exames, pct: stats.revenue ? `${(stats.exames / stats.revenue * 100).toFixed(0)}%` : '0%' },
                cirurgias: { value: stats.cirurgias, pct: stats.revenue ? `${(stats.cirurgias / stats.revenue * 100).toFixed(0)}%` : '0%' },
                consultas: { value: stats.consultas, pct: stats.revenue ? `${(stats.consultas / stats.revenue * 100).toFixed(0)}%` : '0%' }
            });

        } catch (err) {
            console.error('Error fetching financials:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedHospital, tempStartDate, tempEndDate]);

    useEffect(() => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        switch (activeDateFilter) {
            case 'Este Ano':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
            case 'Este Mês':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'Hoje':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'Últimos 7 dias':
                start = new Date(now);
                start.setDate(now.getDate() - 7);
                end = new Date(now);
                break;
            case 'Personalizado':
                return;
        }

        if (start && end) {
            setTempStartDate(start);
            setTempEndDate(end);
        }
    }, [activeDateFilter]);

    const filteredTransactions = useMemo(() => {
        if (!searchTerm) return appointments;
        const lower = searchTerm.toLowerCase();
        return appointments.filter(a =>
            (a.patient_name && a.patient_name.toLowerCase().includes(lower)) ||
            (a.procedure && a.procedure.toLowerCase().includes(lower))
        );
    }, [appointments, searchTerm]);
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentData = filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pago':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Pago
                    </span>
                );
            case 'Pendente':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Pendente
                    </span>
                );
            case 'Não realizado':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                        Não realizado
                    </span>
                );
            default:
                return null;
        }
    };

    const isAdmin = user?.role === UserRole.ADMIN;

    const handleCalendarNav = (direction: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setViewDate(newDate);
    };

    const handleConfirmRepasse = async (appt: any) => {
        if (appt.repasse_status === 'Pago') return;
        if (!confirm(`Confirmar recebimento do repasse de ${formatCurrency(appt.repasse_value)}?`)) return;

        try {
            await appointmentService.update(appt.id, { repasse_status: 'Pago' });
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Erro ao confirmar repasse.');
        }
    };

    const handleEditClick = (item: any) => {
        setEditForm({
            id: item.id,
            patient_name: item.patient_name,
            total_cost: item.total_cost,
            repasse_value: item.repasse_value,
            hospital_value: item.hospital_value,
            payment_status: item.payment_status,
            repasse_status: item.repasse_status || 'Pendente'
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        try {
            await appointmentService.update(editForm.id, {
                total_cost: Number(editForm.total_cost),
                repasse_value: Number(editForm.repasse_value),
                hospital_value: Number(editForm.hospital_value),
                payment_status: editForm.payment_status,
                repasse_status: editForm.repasse_status as any
            });
            setIsEditModalOpen(false);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar edições.');
        }
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
            case 'Hoje': break;
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
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-8 relative">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pagamentos</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Acompanhe registros financeiros e repasses.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {['Este Ano', 'Este Mês', 'Hoje', 'Últimos 7 dias'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveDateFilter(filter)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeDateFilter === filter ? 'bg-red-50 text-primary border border-red-100 dark:bg-primary/20 dark:text-primary-hover dark:border-primary/30' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                            {filter}
                        </button>
                    ))}
                    <button
                        onClick={() => setIsCalendarOpen(true)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeDateFilter === 'Personalizado' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                        Personalizado
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                    { label: 'Faturamento Total', value: formatCurrency(totals.revenue), icon: 'payments' },
                    { label: 'Total de Repasse', value: formatCurrency(totals.repasse), icon: 'attach_money' },
                    { label: 'Faturamento Hosp.', value: formatCurrency(totals.hospital), icon: 'domain' },
                    { label: 'A Receber', value: formatCurrency(totals.pending), icon: 'account_balance_wallet' },
                    { label: 'Repasse a Receber', value: formatCurrency(totals.pendingRepasse), icon: 'currency_exchange' }
                ].map((card, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex items-center gap-4 h-28">
                        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-primary-hover">
                            <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{card.label}</p>
                            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">{card.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: 'Exames', value: formatCurrency(categoryTotals.exames.value), icon: 'biotech', color: 'indigo', pct: categoryTotals.exames.pct },
                    { title: 'Cirurgias', value: formatCurrency(categoryTotals.cirurgias.value), icon: 'medical_services', color: 'teal', pct: categoryTotals.cirurgias.pct },
                    { title: 'Consultas', value: formatCurrency(categoryTotals.consultas.value), icon: 'stethoscope', color: 'purple', pct: categoryTotals.consultas.pct }
                ].map((item, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex items-center justify-between p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-primary-hover">
                                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.title}</p>
                        </div>
                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{item.value}</h3>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto flex-1">
                    <div className="relative w-full sm:max-w-md">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 rounded-2xl border-none bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400"
                            placeholder="Buscar por paciente ou procedimento..."
                        />
                    </div>
                    {isAdmin ? (
                        <div className="relative w-full sm:w-56">
                            <select
                                value={selectedHospital}
                                onChange={(e) => setSelectedHospital(e.target.value)}
                                className="w-full h-12 pl-4 pr-10 appearance-none rounded-2xl border-none bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-primary text-slate-700 dark:text-white cursor-pointer"
                            >
                                <option>Todos os Hospitais</option>
                                {hospitals.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
                        </div>
                    ) : (
                        <div className="relative w-full sm:w-56">
                            <div className="w-full h-12 px-4 flex items-center rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold text-slate-400 cursor-not-allowed">
                                <span className="material-symbols-outlined text-[18px] mr-2">lock</span>
                                <span className="truncate">{user?.hospitalName}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm card-shadow flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <th className="px-3 py-3 text-left">Paciente</th>
                                <th className="px-3 py-3 text-left">Procedimento</th>
                                <th className="px-3 py-3 text-left">Hospital</th>
                                <th className="px-3 py-3 whitespace-nowrap">Data</th>
                                <th className="px-3 py-3 whitespace-nowrap">Valor Cheio</th>
                                <th className="px-3 py-3 whitespace-nowrap">Repasse</th>
                                <th className="px-3 py-3 whitespace-nowrap">Hospital</th>
                                <th className="px-3 py-3 text-center whitespace-nowrap">Status Pag.</th>
                                <th className="px-3 py-3 text-center whitespace-nowrap">Status Repasse</th>
                                <th className="px-3 py-3 text-right whitespace-nowrap">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">Carregando...</td></tr>
                            ) : currentData.length > 0 ? (
                                currentData.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-3 py-3 font-bold text-slate-900 dark:text-white min-w-[120px]">{item.patient_name}</td>
                                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300 font-medium min-w-[120px]">{item.procedure}</td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400 min-w-[120px]">{item.hospital?.name}</td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(item.date)}</td>
                                        <td className="px-3 py-3 text-slate-900 dark:text-white font-bold whitespace-nowrap">{formatCurrency(item.total_cost)}</td>
                                        <td className="px-3 py-3 text-primary font-bold whitespace-nowrap">{formatCurrency(item.repasse_value)}</td>
                                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatCurrency(item.hospital_value)}</td>
                                        <td className="px-3 py-3 text-center whitespace-nowrap">{getStatusBadge(item.payment_status)}</td>
                                        <td className="px-3 py-3 text-center whitespace-nowrap">{getStatusBadge(item.repasse_status || 'Pendente')}</td>
                                        <td className="px-3 py-3 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                {(!item.repasse_status || item.repasse_status === 'Pendente') && (
                                                    <button
                                                        onClick={() => handleConfirmRepasse(item)}
                                                        title="Confirmar Recebimento"
                                                        className="p-2 text-amber-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditClick(item)}
                                                    title="Editar"
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Mostrando <span className="font-bold text-slate-900 dark:text-white">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredTransactions.length)}</span> de {filteredTransactions.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-300 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button key={i} onClick={() => goToPage(i + 1)} className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${currentPage === i + 1 ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{i + 1}</button>
                        ))}
                        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-300 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {
                isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Editar Financeiro</h3>
                            <p className="text-sm text-slate-500 mb-6">Editando registro de <span className="font-bold text-slate-700 dark:text-slate-300">{editForm.patient_name}</span></p>

                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Valor Cheio</label>
                                        <input
                                            type="number"
                                            value={editForm.total_cost}
                                            onChange={e => setEditForm({ ...editForm, total_cost: e.target.value })}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Repasse</label>
                                        <input
                                            type="number"
                                            value={editForm.repasse_value}
                                            onChange={e => setEditForm({ ...editForm, repasse_value: e.target.value })}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Hospital</label>
                                        <input
                                            type="number"
                                            value={editForm.hospital_value}
                                            onChange={e => setEditForm({ ...editForm, hospital_value: e.target.value })}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Status Pagamento</label>
                                        <select
                                            value={editForm.payment_status}
                                            onChange={e => setEditForm({ ...editForm, payment_status: e.target.value })}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                        >
                                            <option value="Pendente">Pendente</option>
                                            <option value="Pago">Pago</option>
                                            <option value="Não realizado">Não realizado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Status Repasse</label>
                                        <select
                                            value={editForm.repasse_status}
                                            onChange={e => setEditForm({ ...editForm, repasse_status: e.target.value })}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                        >
                                            <option value="Pendente">Pendente</option>
                                            <option value="Pago">Pago</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                                <button onClick={handleSaveEdit} className="px-6 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all">Salvar Alterações</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isCalendarOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex border border-slate-200 dark:border-slate-700 h-[500px]">
                            <div className="w-64 bg-slate-50/80 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-2 overflow-y-auto">
                                {['Hoje', 'Ontem', 'Hoje e ontem', 'Últimos 7 dias', 'Últimos 14 dias', 'Últimos 28 dias', 'Últimos 30 dias', 'Esta semana', 'Este mês'].map(preset => (
                                    <button key={preset} onClick={() => applyPreset(preset)} className="text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all">{preset}</button>
                                ))}
                            </div>
                            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => handleCalendarNav(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
                                        <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                                        <button onClick={() => handleCalendarNav(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Intervalo Selecionado</p>
                                        <p className="text-sm font-bold text-primary dark:text-primary-hover">{formatRangeLabel()}</p>
                                    </div>
                                    <button onClick={() => setIsCalendarOpen(false)} className="text-slate-400 hover:text-slate-600 ml-4"><span className="material-symbols-outlined">close</span></button>
                                </div>
                                <div className="flex-1 p-8 overflow-y-auto">
                                    <div className="grid grid-cols-7 mb-4">
                                        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
                                            <div key={i} className={`text-center text-xs font-bold uppercase tracking-widest ${i === 0 || i === 6 ? 'text-primary opacity-60' : 'text-slate-400'}`}>{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-y-2 gap-x-0">
                                        {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (<div key={`empty-${i}`} />))}
                                        {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                                            const day = i + 1;
                                            const isStart = isRangeStart(day);
                                            const isEnd = isRangeEnd(day);
                                            const isMiddle = isRangeMiddle(day);
                                            const selected = isSelected(day);
                                            return (
                                                <div key={day} className="relative h-10 flex items-center justify-center">
                                                    {isMiddle && <div className="absolute inset-x-0 top-1 bottom-1 bg-red-50 dark:bg-primary/10"></div>}
                                                    {isStart && tempEndDate && <div className="absolute left-1/2 right-0 top-1 bottom-1 bg-red-50 dark:bg-primary/10 rounded-l-md"></div>}
                                                    {isEnd && tempStartDate && <div className="absolute left-0 right-1/2 top-1 bottom-1 bg-red-50 dark:bg-primary/10 rounded-r-md"></div>}
                                                    <button onClick={() => handleDayClick(day)} className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${selected && !isMiddle ? 'bg-primary text-white shadow-lg shadow-primary/30 transform scale-105' : ''} ${!selected && !isMiddle ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : ''} ${isMiddle ? 'text-primary dark:text-primary-hover bg-red-50 dark:bg-primary/10 rounded-none w-full' : ''}`}>{day}</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end bg-slate-50/50 dark:bg-slate-800/20">
                                    <button onClick={() => setIsCalendarOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">CANCELAR</button>
                                    <button onClick={() => { setActiveDateFilter('Personalizado'); setIsCalendarOpen(false); }} className="ml-3 px-8 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 transition-all transform active:scale-95">ATUALIZAR</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Financials;
