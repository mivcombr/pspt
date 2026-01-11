import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { APP_TIME_ZONE, formatCurrency, formatDate, parseCurrency } from '../utils/formatters';
import { Badge } from '../components/ui/Badge';
import { useNotification } from '../hooks/useNotification';

const ITEMS_PER_PAGE = 10;

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const Financials: React.FC = () => {
    const { user } = useAuth();
    const notify = useNotification();
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedHospital, setSelectedHospital] = useState('Todos os Hospitais');
    const [hospitals, setHospitals] = useState<any[]>([]);

    const [activeDateFilter, setActiveDateFilter] = useState('Este Mês');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [viewDate, setViewDate] = useState(new Date());
    const [tempStartDate, setTempStartDate] = useState<Date | null>(new Date());
    const [tempEndDate, setTempEndDate] = useState<Date | null>(new Date());

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos Pagamentos');
    const [repasseStatusFilter, setRepasseStatusFilter] = useState('Todos Acertos');

    // History Modal State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

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
        repasse_status: '',
        financial_additional: ''
    });

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmForm, setConfirmForm] = useState({
        id: '',
        patient_name: '',
        hospital_value: 0,
        repasse_value: 0,
        financial_additional: 0,
        payments: [] as any[]
    });

    const [categoryTotals, setCategoryTotals] = useState({
        exames: { value: 0, pct: '0%' },
        cirurgias: { value: 0, pct: '0%' },
        consultas: { value: 0, pct: '0%' }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const formatDateForInput = (date: Date | null) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatMoneyValue = (value: number | null | undefined) =>
        Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatMoneyInput = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (!digits) return '';
        const numeric = Number(digits) / 100;
        return numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatReportRange = () => {
        if (!tempStartDate || !tempEndDate) return 'Período não definido';
        const start = formatDate(tempStartDate);
        const end = formatDate(tempEndDate);
        return `${start} a ${end}`;
    };

    const buildReportHtml = () => {
        const rows = filteredTransactions.map((item) => {
            const payments = (item.payments || []).map((p: any) => p.method).join(' / ') || '-';
            return `
                <tr>
                    <td>${item.patient_name || '-'}</td>
                    <td>${item.procedure || '-'}</td>
                    <td>${item.hospital?.name || '-'}</td>
                    <td>${formatDate(item.date)}</td>
                    <td>${payments}</td>
                    <td>${item.payment_status || '-'}</td>
                    <td>${item.repasse_status || 'Pendente'}</td>
                    <td>${formatCurrency(Number(item.hospital_value || 0))}</td>
                    <td>${formatCurrency(Number(item.repasse_value || 0))}</td>
                </tr>
            `;
        }).join('');

        return `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Relatório Financeiro</title>
                    <style>
                        * { box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
                        h1 { font-size: 20px; margin: 0 0 8px 0; }
                        .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
                        .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
                        .summary-item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
                        .summary-item span { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
                        .summary-item strong { font-size: 14px; display: block; margin-top: 6px; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
                        th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; color: #64748b; }
                        .section-title { font-size: 12px; font-weight: 700; margin: 14px 0 8px; }
                    </style>
                </head>
                <body>
                    <h1>Relatório Financeiro - Pagamentos</h1>
                    <div class="meta"><strong>Período:</strong> ${formatReportRange()} • <strong>Gerado em:</strong> ${formatDate(new Date())}</div>
                    <div class="summary">
                        <div class="summary-item"><span>Faturamento Total</span><strong>${formatCurrency(filteredTotals.revenue)}</strong></div>
                        <div class="summary-item"><span>Faturamento Hospital</span><strong>${formatCurrency(filteredTotals.hospital)}</strong></div>
                        <div class="summary-item"><span>Total do Programa</span><strong>${formatCurrency(filteredTotals.repasse)}</strong></div>
                        <div class="summary-item"><span>A Receber</span><strong>${formatCurrency(filteredTotals.pending)}</strong></div>
                        <div class="summary-item"><span>Programa a Receber</span><strong>${formatCurrency(filteredTotals.pendingRepasse)}</strong></div>
                    </div>
                    <div class="section-title">Detalhamento</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>Procedimento</th>
                                <th>Hospital</th>
                                <th>Data</th>
                                <th>Pagamento</th>
                                <th>Status Pag.</th>
                                <th>Status Acerto</th>
                                <th>Hospital</th>
                                <th>Programa</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="9">Nenhum registro para o período selecionado.</td></tr>'}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
    };

    const handleExportReport = () => {
        setIsExporting(true);
        try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.setAttribute('aria-hidden', 'true');
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow?.document;
            if (!doc || !iframe.contentWindow) {
                notify.error('Não foi possível iniciar a exportação do relatório.');
                iframe.remove();
                return;
            }

            doc.open();
            doc.write(buildReportHtml());
            doc.close();

            iframe.onload = () => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                    iframe.remove();
                }, 500);
            };
            notify.success('Relatório pronto para exportação em PDF.');
        } catch (err) {
            console.error('Erro ao exportar relatório:', err);
            notify.error('Erro ao exportar relatório.');
        } finally {
            setIsExporting(false);
        }
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
        return appointments.filter(a => {
            const matchesSearch = !searchTerm ||
                (a.patient_name && a.patient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (a.procedure && a.procedure.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesPayment = statusFilter === 'Todos Pagamentos' || a.payment_status === statusFilter;
            const matchesRepasse = repasseStatusFilter === 'Todos Acertos' || (a.repasse_status || 'Pendente') === repasseStatusFilter;

            return matchesSearch && matchesPayment && matchesRepasse;
        });
    }, [appointments, searchTerm, statusFilter, repasseStatusFilter]);
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentData = filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const filteredTotals = useMemo(() => {
        return filteredTransactions.reduce((acc, curr) => {
            const cost = Number(curr.total_cost);
            acc.revenue += cost;
            acc.repasse += Number(curr.repasse_value);
            acc.hospital += Number(curr.hospital_value);
            if (curr.payment_status === 'Pendente') acc.pending += cost;
            if (curr.repasse_status === 'Pendente' || !curr.repasse_status) acc.pendingRepasse += Number(curr.repasse_value);

            if (curr.type === 'EXAME') acc.exames += cost;
            else if (curr.type === 'CIRURGIA') acc.cirurgias += cost;
            else if (curr.type === 'CONSULTA') acc.consultas += cost;

            return acc;
        }, { revenue: 0, repasse: 0, hospital: 0, pending: 0, pendingRepasse: 0, exames: 0, cirurgias: 0, consultas: 0 });
    }, [filteredTransactions]);

    const filteredCategoryTotals = useMemo(() => {
        return {
            exames: {
                value: filteredTotals.exames,
                pct: filteredTotals.revenue ? `${(filteredTotals.exames / filteredTotals.revenue * 100).toFixed(0)}%` : '0%'
            },
            cirurgias: {
                value: filteredTotals.cirurgias,
                pct: filteredTotals.revenue ? `${(filteredTotals.cirurgias / filteredTotals.revenue * 100).toFixed(0)}%` : '0%'
            },
            consultas: {
                value: filteredTotals.consultas,
                pct: filteredTotals.revenue ? `${(filteredTotals.consultas / filteredTotals.revenue * 100).toFixed(0)}%` : '0%'
            }
        };
    }, [filteredTotals]);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const renderPaymentMethod = (item: any) => {
        const payments = item.payments || [];

        if (payments.length > 1) {
            return (
                <div className="has-tooltip inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/30 transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-primary">account_tree</span>
                    Misto
                    <div className="tooltip-content shadow-2xl animate-in fade-in zoom-in duration-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 border-b border-white/10 pb-1.5">Detalhamento do Pagamento</p>
                        <div className="space-y-2">
                            {payments.map((p: any, i: number) => (
                                <div key={i} className="flex justify-between items-center gap-8">
                                    <span className="font-bold text-slate-300">{p.method}</span>
                                    <span className="font-black text-white">{formatCurrency(p.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (payments.length === 1) {
            return (
                <span className="text-slate-600 dark:text-slate-300 font-bold text-xs truncate max-w-[100px] block">
                    {payments[0].method}
                </span>
            );
        }

        // Legacy support
        return (
            <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                {item.payment_method || '-'}
            </span>
        );
    };

    const getStatusBadge = (status: string, type: 'payment' | 'repasse' = 'payment') => {
        const labels = {
            payment: {
                Pago: 'Pagamento Recebido',
                Pendente: 'Pagamento Pendente',
                'Não realizado': 'Não realizado'
            },
            repasse: {
                Pago: 'Acerto Realizado',
                Pendente: 'Acerto Pendente'
            }
        };

        const label = labels[type][status as keyof typeof labels[typeof type]] || status;

        switch (status) {
            case 'Pago':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        {label}
                    </span>
                );
            case 'Pendente':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        {label}
                    </span>
                );
            case 'Não realizado':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                        {label}
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

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const handleOpenHistory = async (patientName: string, patientPhone?: string, patientBirthDate?: string) => {
        // Find full patient details from the current list or fetch if needed
        // For now, we use the passed data
        setSelectedPatient({ name: patientName, phone: patientPhone, birthDate: patientBirthDate });
        setIsHistoryOpen(true);
        setIsFetchingHistory(true);
        try {
            // Note: We need birthDate to accurately find history. 
            // If birthDate is missing in the row data, the history fetch might fail or return empty.
            // Ensure getAll returns birthDate.
            const data = await appointmentService.getPatientHistory(patientName, patientBirthDate || '');
            setHistory(data);
        } catch (err) {
            console.error('Error fetching history:', err);
            alert('Erro ao carregar histórico.');
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleConfirmRepasse = (appt: any) => {
        if (!isAdmin) return;
        setConfirmForm({
            id: appt.id,
            patient_name: appt.patient_name,
            hospital_value: appt.hospital_value || 0,
            repasse_value: appt.repasse_value || 0,
            financial_additional: appt.financial_additional || 0,
            payments: (appt.payments || []).map((p: any) => ({
                ...p,
                confirmed: p.confirmed ?? false
            }))
        });
        setIsConfirmModalOpen(true);
    };

    const handleSaveConfirmation = async () => {
        try {
            const net_value = Number(confirmForm.hospital_value) + Number(confirmForm.repasse_value) + Number(confirmForm.financial_additional);

            await appointmentService.update(confirmForm.id, {
                hospital_value: confirmForm.hospital_value,
                repasse_value: confirmForm.repasse_value,
                financial_additional: confirmForm.financial_additional,
                net_value: net_value,
                repasse_status: 'Pago',
                repasse_paid_at: new Date().toISOString()
            });

            // Update individual payments to confirmed
            for (const p of confirmForm.payments) {
                await appointmentService.updatePayment(p.id, { confirmed: true });
            }

            setIsConfirmModalOpen(false);
            fetchData();
            notify.success('Recebimento confirmado com sucesso!');
        } catch (e: any) {
            console.error('Erro ao confirmar:', e);
            notify.error('Erro ao salvar confirmação.');
        }
    };

    const handleEditClick = (item: any) => {
        setEditForm({
            id: item.id,
            patient_name: item.patient_name,
            total_cost: formatMoneyValue(item.total_cost),
            repasse_value: formatMoneyValue(item.repasse_value),
            hospital_value: formatMoneyValue(item.hospital_value),
            payment_status: item.payment_status,
            repasse_status: item.repasse_status || 'Pendente',
            financial_additional: formatMoneyValue(item.financial_additional || 0)
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        try {
            const totalCost = parseCurrency(editForm.total_cost);
            const repasseValue = parseCurrency(editForm.repasse_value);
            const hospitalValue = parseCurrency(editForm.hospital_value);
            const additionalValue = parseCurrency(editForm.financial_additional);
            const net_value = hospitalValue + repasseValue + additionalValue;
            await appointmentService.update(editForm.id, {
                total_cost: totalCost,
                repasse_value: repasseValue,
                hospital_value: hospitalValue,
                financial_additional: additionalValue,
                net_value: net_value,
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
        <div className="max-w-screen-xl w-full mx-auto space-y-6 sm:space-y-8 pb-8 relative px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-5">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pagamentos</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Acompanhe registros financeiros e repasses.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
                    <button
                        onClick={handleExportReport}
                        disabled={isExporting || filteredTransactions.length === 0}
                        className="h-10 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        {isExporting ? 'Exportando...' : 'Exportar PDF'}
                    </button>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto overflow-x-auto sm:overflow-visible">
                        {['Este Ano', 'Este Mês', 'Hoje', 'Últimos 7 dias'].map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveDateFilter(filter)}
                                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeDateFilter === filter ? 'bg-white text-primary border border-red-100 dark:bg-primary/20 dark:text-primary-hover dark:border-primary/30' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                {filter}
                            </button>
                        ))}
                        <button
                            onClick={() => setIsCalendarOpen(true)}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeDateFilter === 'Personalizado' ? 'bg-white text-slate-800 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            Personalizado
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-5">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-[7.5rem] sm:h-[8.5rem] rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200 dark:border-slate-700" />
                    ))
                ) : (
                    [
                        { label: 'Faturamento Total', value: formatCurrency(filteredTotals.revenue), icon: 'payments' },
                        { label: 'Faturamento Hospital', value: formatCurrency(filteredTotals.hospital), icon: 'domain' },
                        { label: 'Total do Programa', value: formatCurrency(filteredTotals.repasse), icon: 'attach_money' },
                        {
                            label: 'A Receber',
                            value: formatCurrency(filteredTotals.pending),
                            icon: 'account_balance_wallet',
                            helper: 'Valor a ser pago pelos pacientes',
                            highlight: true,
                            divider: true
                        },
                        {
                            label: 'Programa a Receber',
                            value: formatCurrency(filteredTotals.pendingRepasse),
                            icon: 'currency_exchange',
                            helper: 'Valor em aberto a ser repassado',
                            highlight: true
                        }
                    ].map((card, i) => (
                        <div
                            key={i}
                            className={`relative p-4 sm:p-6 rounded-3xl border shadow-sm card-shadow min-h-[7.5rem] sm:min-h-[8.5rem] min-w-0 ${card.highlight ? 'bg-[rgb(254,242,242)] border-red-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${card.highlight ? 'bg-white text-primary border border-red-100' : 'bg-red-50 dark:bg-slate-800 text-primary dark:text-primary-hover'}`}>
                                    <span className="material-symbols-outlined text-[20px] sm:text-[22px]">{card.icon}</span>
                                </div>
                            </div>
                            <div className="mt-4 min-w-0">
                                <p className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide ${card.highlight ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>{card.label}</p>
                                <h3 className="text-[clamp(0.95rem,4vw,1.25rem)] sm:text-[clamp(1rem,2.6vw,1.35rem)] font-extrabold text-slate-900 dark:text-white tracking-tight mt-2 leading-tight whitespace-normal break-words">
                                    {card.value}
                                </h3>
                                {card.helper ? (
                                    <span
                                        title={card.helper}
                                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">info</span>
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[5.5rem] rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200 dark:border-slate-700" />
                    ))
                ) : (
                    [
                        { title: 'Exames', value: formatCurrency(filteredCategoryTotals.exames.value), icon: 'biotech', color: 'indigo', pct: filteredCategoryTotals.exames.pct },
                        { title: 'Cirurgias', value: formatCurrency(filteredCategoryTotals.cirurgias.value), icon: 'medical_services', color: 'teal', pct: filteredCategoryTotals.cirurgias.pct },
                        { title: 'Consultas', value: formatCurrency(filteredCategoryTotals.consultas.value), icon: 'stethoscope', color: 'purple', pct: filteredCategoryTotals.consultas.pct }
                    ].map((item, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-5 gap-2 sm:gap-3 min-w-0 text-center sm:text-left">
                            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 min-w-0">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-primary-hover shrink-0">
                                    <span className="material-symbols-outlined text-[20px] sm:text-[22px]">{item.icon}</span>
                                </div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight whitespace-normal">{item.title}</p>
                            </div>
                            <h3 className="text-[clamp(0.95rem,4vw,1.2rem)] sm:text-[clamp(1.125rem,3.2vw,1.5rem)] font-extrabold text-slate-900 dark:text-white leading-tight whitespace-normal break-words">{item.value}</h3>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col xl:flex-row items-center gap-3 sm:gap-4 w-full flex-1">
                    <div className="relative w-full xl:max-w-md">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 rounded-2xl border-none bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400 transition-all"
                            placeholder="Buscar por paciente ou procedimento..."
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-2 w-full xl:w-auto">
                        {isAdmin ? (
                            <div className="relative w-full sm:flex-none sm:w-56">
                                <select
                                    value={selectedHospital}
                                    onChange={(e) => setSelectedHospital(e.target.value)}
                                    className="w-full h-12 pl-4 pr-10 appearance-none rounded-2xl border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-primary text-slate-700 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <option>Todos os Hospitais</option>
                                    {hospitals.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
                            </div>
                        ) : (
                            <div className="relative w-full sm:flex-none sm:w-56">
                                <div className="w-full h-12 px-4 flex items-center rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold text-slate-400 cursor-not-allowed">
                                    <span className="material-symbols-outlined text-[18px] mr-2">lock</span>
                                    <span className="truncate">{user?.hospitalName}</span>
                                </div>
                            </div>
                        )}

                        <div className="relative w-full sm:flex-none sm:w-44">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full h-12 pl-4 pr-10 appearance-none rounded-2xl border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-primary text-slate-700 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <option value="Todos Pagamentos">Status Pag.</option>
                                <option value="Pago">Pago</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Não realizado">Não realizado</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">payments</span>
                        </div>

                        <div className="relative w-full sm:flex-none sm:w-44">
                            <select
                                value={repasseStatusFilter}
                                onChange={(e) => setRepasseStatusFilter(e.target.value)}
                                className="w-full h-12 pl-4 pr-10 appearance-none rounded-2xl border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-primary text-slate-700 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <option value="Todos Acertos">Status Acerto</option>
                                <option value="Pago">Pago</option>
                                <option value="Pendente">Pendente</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">currency_exchange</span>
                        </div>

                        {(searchTerm || statusFilter !== 'Todos Pagamentos' || repasseStatusFilter !== 'Todos Acertos' || (isAdmin && selectedHospital !== 'Todos os Hospitais')) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setStatusFilter('Todos Pagamentos');
                                    setRepasseStatusFilter('Todos Acertos');
                                    if (isAdmin) setSelectedHospital('Todos os Hospitais');
                                }}
                                className="h-12 px-4 rounded-2xl bg-red-50 text-primary hover:bg-red-100 transition-colors flex items-center gap-2 text-xs font-bold w-full sm:w-auto justify-center"
                            >
                                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm card-shadow flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="hidden lg:table-header-group">
                            <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-200 dark:border-slate-700">
                                <th className="px-6 py-4">Paciente / Procedimento</th>
                                <th className="px-6 py-4">Unidade / Data</th>
                                <th className="px-6 py-4">Pagamento</th>
                                <th className="px-6 py-4">Distribuição</th>
                                {isAdmin && <th className="px-6 py-4 text-green-600">Total Líquido</th>}
                                <th className="px-6 py-4 text-center">Status Pag.</th>
                                <th className="px-6 py-4 text-center">Status Acerto</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {isLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                                        {isAdmin && <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded mx-auto" /></td>
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded mx-auto" /></td>
                                        <td className="hidden lg:table-cell px-6 py-5"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded ml-auto" /></td>
                                    </tr>
                                ))
                            ) : currentData.length > 0 ? (
                                currentData.map((item) => (
                                    <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all hover:z-[50] relative">
                                        {/* Desktop View (Table Cells) */}
                                        <td className="hidden lg:table-cell px-6 py-5 align-top">
                                            <div className="flex flex-col">
                                                <button
                                                    onClick={() => handleOpenHistory(item.patient_name, item.patient_phone, item.patient_birth_date)}
                                                    className="font-black text-slate-900 dark:text-white hover:text-primary transition-colors text-sm text-left leading-tight"
                                                >
                                                    {item.patient_name}
                                                </button>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">{item.procedure}</span>
                                            </div>
                                        </td>

                                        <td className="hidden lg:table-cell px-6 py-5 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{item.hospital?.name}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase mt-1 opacity-70 italic">{formatDate(item.date)}</span>
                                            </div>
                                        </td>

                                        <td className="hidden lg:table-cell px-6 py-5 align-top">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="scale-90 origin-left">{renderPaymentMethod(item)}</div>
                                                <span className="font-black text-slate-900 dark:text-white text-xs">{formatCurrency(item.total_cost)}</span>
                                            </div>
                                        </td>

                                        <td className="hidden lg:table-cell px-6 py-5 align-top">
                                            <div className="grid grid-cols-1 gap-1">
                                                <div className="flex justify-between gap-4 text-[10px]">
                                                    <span className="font-bold text-slate-400 uppercase">Hospital:</span>
                                                    <span className="font-black text-slate-600 dark:text-slate-400">{formatCurrency(item.hospital_value)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4 text-[10px]">
                                                    <span className="font-bold text-slate-400 uppercase">Programa:</span>
                                                    <span className="font-black text-primary">{formatCurrency(item.repasse_value)}</span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex justify-between gap-4 text-[10px]">
                                                        <div className="flex items-center gap-1 has-tooltip">
                                                            <span className="font-bold text-slate-400 uppercase">Adicional:</span>
                                                            <span className="material-symbols-outlined text-[12px] text-slate-300">info</span>
                                                            <div className="tooltip-content shadow-2xl w-48 !whitespace-normal">
                                                                Diferença de parcelamento
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-amber-600">{formatCurrency(item.financial_additional || 0)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {isAdmin && (
                                            <td className="hidden lg:table-cell px-6 py-5 align-top text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-sm font-black text-green-600 tracking-tight">
                                                        {formatCurrency(item.net_value || (Number(item.hospital_value || 0) + Number(item.repasse_value || 0) + Number(item.financial_additional || 0)))}
                                                    </span>
                                                    <div className="h-0.5 w-full bg-green-500/10 dark:bg-green-500/20 rounded-full mt-1"></div>
                                                </div>
                                            </td>
                                        )}

                                        <td className="hidden lg:table-cell px-6 py-5 align-top text-center border-l border-slate-50 dark:border-slate-800/10">
                                            <div className="scale-90 origin-center">{getStatusBadge(item.payment_status, 'payment')}</div>
                                        </td>

                                        <td className="hidden lg:table-cell px-6 py-5 align-top text-center">
                                            <div className="flex flex-col items-center scale-90 origin-center">
                                                {getStatusBadge(item.repasse_status || 'Pendente', 'repasse')}
                                                {item.repasse_status === 'Pago' && item.repasse_paid_at && (
                                                    <span className="text-[9px] font-bold text-slate-400 mt-1">{formatDate(item.repasse_paid_at)}</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="hidden lg:table-cell px-6 py-5 align-top text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {isAdmin && (!item.repasse_status || item.repasse_status === 'Pendente') && (
                                                    <button
                                                        onClick={() => handleConfirmRepasse(item)}
                                                        className="size-9 flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-all hover:scale-110 active:scale-95"
                                                        title="Acerto Financeiro"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">payments</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditClick(item)}
                                                    className="size-9 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all hover:scale-110 active:scale-95"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                            </div>
                                        </td>

                                        {/* Mobile / Tablet View (Card) */}
                                        <td colSpan={isAdmin ? 8 : 7} className="lg:hidden p-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex flex-col">
                                                        <button
                                                            onClick={() => handleOpenHistory(item.patient_name, item.patient_phone, item.patient_birth_date)}
                                                            className="font-black text-slate-900 dark:text-white text-sm text-left"
                                                        >
                                                            {item.patient_name}
                                                        </button>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.procedure}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {isAdmin && (
                                                            <>
                                                                {(!item.repasse_status || item.repasse_status === 'Pendente') && (
                                                                    <button onClick={() => handleConfirmRepasse(item)} className="size-8 flex items-center justify-center bg-amber-500 text-white rounded-lg shadow-lg shadow-amber-500/20">
                                                                        <span className="material-symbols-outlined text-[18px]">payments</span>
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <button onClick={() => handleEditClick(item)} className="size-8 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-400 rounded-lg border border-slate-200 dark:border-slate-600">
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidade / Data</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">{item.hospital?.name}</p>
                                                        <p className="text-[10px] text-slate-400 italic mt-0.5">{formatDate(item.date)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pagamento</p>
                                                        <div className="scale-75 origin-left">{renderPaymentMethod(item)}</div>
                                                        <p className="text-xs font-black text-slate-900 dark:text-white mt-1">{formatCurrency(item.total_cost)}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Distribuição</p>
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                                            <span>Hospital</span>
                                                            <span className="text-slate-700 dark:text-slate-300">{formatCurrency(item.hospital_value)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-1">
                                                            <span>Programa</span>
                                                            <span className="text-primary">{formatCurrency(item.repasse_value)}</span>
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-1">
                                                                <span>Adicional</span>
                                                                <span className="text-amber-600">{formatCurrency(item.financial_additional || 0)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    <div className="flex flex-col">
                                                        {isAdmin ? (
                                                            <>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Líquido</span>
                                                                <span className="text-base font-black text-green-600">
                                                                    {formatCurrency(item.net_value || (Number(item.hospital_value || 0) + Number(item.repasse_value || 0) + Number(item.financial_additional || 0)))}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Valor Total</span>
                                                                <span className="text-base font-black text-slate-900 dark:text-white">
                                                                    {formatCurrency(item.total_cost)}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 scale-75 origin-right">
                                                        {getStatusBadge(item.payment_status, 'payment')}
                                                        {getStatusBadge(item.repasse_status || 'Pendente', 'repasse')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                                                <span className="material-symbols-outlined text-4xl">payments</span>
                                            </div>
                                            <p className="text-slate-500 font-bold">Nenhum registro encontrado para este período.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Mostrando <span className="text-slate-700 dark:text-slate-200">{currentData.length}</span> de <span className="text-slate-700 dark:text-slate-200">{filteredTransactions.length}</span> registros
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => goToPage(i + 1)}
                                        className={`size-8 rounded-lg text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600'}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Editar Registro</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined text-slate-400">close</span>
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Valor Pago</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={editForm.total_cost}
                                                onChange={e => setEditForm({ ...editForm, total_cost: formatMoneyInput(e.target.value) })}
                                                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Valor do Programa</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={editForm.repasse_value}
                                                onChange={e => setEditForm({ ...editForm, repasse_value: formatMoneyInput(e.target.value) })}
                                                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-primary"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Hospital</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={editForm.hospital_value}
                                                onChange={e => setEditForm({ ...editForm, hospital_value: formatMoneyInput(e.target.value) })}
                                                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Adicional</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editForm.financial_additional}
                                                    onChange={e => setEditForm({ ...editForm, financial_additional: formatMoneyInput(e.target.value) })}
                                                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-amber-600"
                                                />
                                            </div>
                                        </div>
                                    )}
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
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Status Programa</label>
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
                                <button onClick={handleSaveEdit} className="px-6 py-2 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all">Salvar Alterações</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


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
                                        <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: APP_TIME_ZONE })}</span>
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
                                    <button onClick={() => { setActiveDateFilter('Personalizado'); setIsCalendarOpen(false); }} className="ml-3 px-8 py-2.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all transform active:scale-95">ATUALIZAR</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* History Sidebar/Modal */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-end animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />

                    <div className="relative w-full max-w-2xl h-screen bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        {/* Modal Header */}
                        <div className="bg-white dark:bg-slate-900 p-8 border-b border-slate-200 dark:border-slate-800 shrink-0">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="size-16 rounded-3xl bg-primary text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-primary/20">
                                        {selectedPatient && getInitials(selectedPatient.name)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedPatient?.name}</h2>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">id_card</span>
                                                Prontuário Digital
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefone</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatient?.phone}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nascimento</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatient && formatDate(selectedPatient.birthDate)}</p>
                                </div>
                            </div>
                        </div>

                        {/* History Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">history</span>
                                Histórico de Atendimentos
                            </h3>

                            <div className="space-y-6">
                                {isFetchingHistory ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="h-32 rounded-3xl bg-white dark:bg-slate-900 animate-pulse border border-slate-100 dark:border-slate-800" />
                                    ))
                                ) : history.length > 0 ? (
                                    history.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="relative pl-10 before:content-[''] before:absolute before:left-[19px] before:top-8 before:bottom-[-24px] before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800 last:before:hidden"
                                        >
                                            {/* Timeline dot */}
                                            <div className="absolute left-0 top-2 size-10 rounded-full bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-slate-950 flex items-center justify-center z-10 shadow-sm">
                                                <div className={`size-3 rounded-full ${item.status === 'Atendido' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-primary shadow-[0_0_10px_rgba(185,41,38,0.4)]'}`}></div>
                                            </div>

                                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                                                    <div>
                                                        <p className="text-xs font-black text-primary uppercase tracking-widest">{formatDate(item.date)} • {item.time?.substring(0, 5)}</p>
                                                        <h4 className="font-bold text-slate-900 dark:text-white mt-0.5">{item.procedure}</h4>
                                                    </div>
                                                    <Badge status={item.status} />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Médico</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.provider || 'Não informado'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Custos</p>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(item.total_cost)}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hospital / Clínica</p>
                                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{item.hospital?.name}</p>
                                                    </div>
                                                </div>

                                                {item.notes && (
                                                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notas</p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{item.notes}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10">
                                        <p className="text-slate-500 font-bold">Nenhum histórico encontrado para este paciente.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Confirmar Recebimento</h3>
                                    <p className="text-slate-500 font-bold text-sm mt-1">{confirmForm.patient_name}</p>
                                </div>
                                <button onClick={() => setIsConfirmModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined text-slate-400">close</span>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Valor do Hospital</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                            <input
                                                type="number"
                                                value={confirmForm.hospital_value}
                                                onChange={e => setConfirmForm({ ...confirmForm, hospital_value: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-12 pl-10 pr-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold focus:border-primary focus:ring-0 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Valor do Programa</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                            <input
                                                type="number"
                                                value={confirmForm.repasse_value}
                                                onChange={e => setConfirmForm({ ...confirmForm, repasse_value: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-12 pl-10 pr-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold focus:border-primary focus:ring-0 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {isAdmin && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Adicional Financeiro (Taxas)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">R$</span>
                                                <input
                                                    type="number"
                                                    value={confirmForm.financial_additional}
                                                    onChange={e => setConfirmForm({ ...confirmForm, financial_additional: parseFloat(e.target.value) || 0 })}
                                                    className="w-full h-12 pl-10 pr-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold focus:border-amber-500 focus:ring-0 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total Líquido da Venda</span>
                                                <span className="text-xl font-black text-green-600 tracking-tight">
                                                    {formatCurrency(Number(confirmForm.hospital_value) + Number(confirmForm.repasse_value) + Number(confirmForm.financial_additional))}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-8 pt-4 flex gap-3">
                            <button
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase text-[10px] tracking-[0.2em]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveConfirmation}
                                className="flex-[2] px-6 py-4 rounded-2xl font-black text-white bg-green-600 hover:bg-green-700 transition-all shadow-xl shadow-green-600/20 uppercase text-[10px] tracking-[0.2em]"
                            >
                                Acerto Realizado
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Financials;
