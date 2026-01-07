import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Appointment, PaymentPart, UserRole } from '../types';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useNotification } from '../hooks/useNotification';
import { ConfirmModal } from '../components/ConfirmModal';

import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { procedureService, Procedure } from '../services/procedureService';
import { scheduleBlockService, ScheduleBlock } from '../services/scheduleBlockService';
import { paymentMethodService, HospitalPaymentMethod } from '../services/paymentMethodService';

interface AttendancesProps {
    isEmbedded?: boolean;
    hospitalFilter?: string;
}

// Helper to get dates for the current week based on a reference date
const getWeekDays = (refDateStr: string) => {
    const refDate = new Date(refDateStr + 'T12:00:00');
    const day = refDate.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToSun = refDate.getDate() - day;

    const weekDates = [];
    const startOfWeek = new Date(refDate);
    startOfWeek.setDate(diffToSun);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }
    return weekDates;
};

const Attendances: React.FC<AttendancesProps> = ({ isEmbedded = false, hospitalFilter }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const notify = useNotification();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [procedures, setProcedures] = useState<Procedure[]>([]);
    const [activeFilter, setActiveFilter] = useState('Todos');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(true);

    // Custom Calendar State
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [pickerMonth, setPickerMonth] = useState(new Date());
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);

    // Cost Editing State
    const [isEditingCost, setIsEditingCost] = useState(false);
    const [costInputValue, setCostInputValue] = useState('');

    // Procedure Editing State
    const [isEditingProcedure, setIsEditingProcedure] = useState(false);
    const [procedureInputValue, setProcedureInputValue] = useState('');

    // Date/Time Editing State
    const [isEditingDateTime, setIsEditingDateTime] = useState(false);
    const [dateInputValue, setDateInputValue] = useState('');
    const [timeInputValue, setTimeInputValue] = useState('');

    // Payment Form State
    const [paymentDraft, setPaymentDraft] = useState<PaymentPart[]>([]);
    const [currentMethod, setCurrentMethod] = useState('Pix');
    const [currentValue, setCurrentValue] = useState('');
    const [currentInstallments, setCurrentInstallments] = useState(1);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'info',
    });

    const [error, setError] = useState<string | null>(null);

    // Patient History Modal State (New)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedPatientForHistory, setSelectedPatientForHistory] = useState<{ name: string, birthDate: string, phone: string } | null>(null);
    const [patientHistory, setPatientHistory] = useState<any[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [hospitalPaymentMethods, setHospitalPaymentMethods] = useState<HospitalPaymentMethod[]>([]);

    // Audit Log State
    const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isFetchingAuditLogs, setIsFetchingAuditLogs] = useState(false);

    // Notes State
    const [notesInputValue, setNotesInputValue] = useState('');

    // Status State
    const [statusInputValue, setStatusInputValue] = useState('');
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);

    // Phone Editing State
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [phoneInputValue, setPhoneInputValue] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Hospital Selector State (for Admin)
    const [hospitalsList, setHospitalsList] = useState<any[]>([]);
    const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
        (!isEmbedded && user?.role !== UserRole.ADMIN) ? (user?.hospitalId || '') : (hospitalFilter || '')
    );

    // Schedule Blocks State
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
    const [isSavingBlock, setIsSavingBlock] = useState(false);
    const [blockForm, setBlockForm] = useState<Partial<ScheduleBlock>>({
        block_type: 'SPECIFIC_DAY',
        hospital_id: '',
        date: '',
        day_of_week: 0,
        start_time: '',
        end_time: '',
        reason: ''
    });

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Priority for hospital filtering:
            // 1. Staff users: always their own hospital
            // 2. Admin: the selected hospital from the dropdown (stored in local state)
            let effectiveHospitalId = selectedHospitalId;

            if (!isEmbedded && user?.role !== UserRole.ADMIN) {
                effectiveHospitalId = user?.hospitalId || '';
            }

            const [appointmentsData, proceduresData] = await Promise.all([
                appointmentService.getAll({ hospitalId: effectiveHospitalId }),
                procedureService.getAll()
            ]);

            // Map the database structure to our Appointment interface
            const mappedData: Appointment[] = appointmentsData.map((apt: any) => ({
                id: apt.id,
                date: apt.date,
                time: apt.time.substring(0, 5), // 'HH:mm:ss' to 'HH:mm'
                patient: apt.patient_name,
                patientPhone: apt.patient_phone,
                patientBirthDate: apt.patient_birth_date,
                plan: apt.plan,
                type: apt.type,
                procedure: apt.procedure,
                provider: apt.provider,
                hospital: apt.hospital?.name || 'N/A',
                status: apt.status,
                paymentStatus: apt.payment_status,
                cost: Number(apt.total_cost),
                payments: apt.payments || [],
                notes: apt.notes || ''
            }));

            setAppointments(mappedData);
            setProcedures(proceduresData);
        } catch (err) {
            console.error('Error fetching appointments:', err);
            setError('Não foi possível carregar os dados. Tente recarregar a página.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (selectedHospitalId) fetchBlocks();
    }, [selectedHospitalId]);

    const fetchBlocks = async () => {
        if (!selectedHospitalId) {
            setScheduleBlocks([]);
            setHospitalPaymentMethods([]);
            return;
        }
        try {
            const [blocks, paymentMethods] = await Promise.all([
                scheduleBlockService.getAll({ hospitalId: selectedHospitalId }),
                paymentMethodService.getAll(selectedHospitalId)
            ]);
            setScheduleBlocks(blocks);
            setHospitalPaymentMethods(paymentMethods);
        } catch (err) {
            console.error('Error fetching blocks/methods:', err);
        }
    };

    const handleSaveBlock = async () => {
        if (!selectedHospitalId || !blockForm.block_type) return;

        if (blockForm.block_type === 'SPECIFIC_DAY' && !blockForm.date) {
            notify.warning('Selecione uma data para o bloqueio');
            return;
        }

        setIsSavingBlock(true);
        try {
            await scheduleBlockService.create({
                hospital_id: selectedHospitalId,
                block_type: blockForm.block_type as any,
                date: blockForm.block_type === 'SPECIFIC_DAY' ? blockForm.date : undefined,
                day_of_week: blockForm.block_type === 'WEEKLY_RECURRING' ? Number(blockForm.day_of_week) : undefined,
                start_time: blockForm.start_time || null as any,
                end_time: blockForm.end_time || null as any,
                reason: blockForm.reason || ''
            });
            notify.success('Bloqueio criado com sucesso!');
            fetchBlocks();
            setBlockForm({ ...blockForm, date: '', start_time: '', end_time: '', reason: '' });
        } catch (err) {
            console.error('Error saving block:', err);
            notify.error('Erro ao salvar bloqueio');
        } finally {
            setIsSavingBlock(false);
        }
    };

    const handleDeleteBlock = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Bloqueio',
            message: 'Tem certeza que deseja remover este bloqueio?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await scheduleBlockService.delete(id);
                    notify.success('Bloqueio removido!');
                    fetchBlocks();
                } catch (err) {
                    notify.error('Erro ao remover bloqueio');
                }
            }
        });
    };

    useEffect(() => {
        const fetchHospitals = async () => {
            if (user?.role === UserRole.ADMIN) {
                try {
                    const data = await hospitalService.getAll();
                    setHospitalsList(data);
                } catch (err) {
                    console.error('Error fetching hospitals:', err);
                }
            }
        };
        fetchHospitals();
    }, [user?.role]);

    // Close calendar on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setIsDatePickerOpen(false);
            }
        };
        if (isDatePickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDatePickerOpen]);


    // --- Logic Helpers ---

    // Local formatters removed - using centralized ones from ../utils/formatters

    const navigateDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const getFormattedDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T12:00:00');
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
        return date.toLocaleDateString('pt-BR', options);
    };

    const getWeekRangeLabel = (dateStr: string) => {
        const dates = getWeekDays(dateStr);
        const first = new Date(dates[0] + 'T12:00:00');
        const last = new Date(dates[6] + 'T12:00:00');
        const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        const startStr = first.toLocaleDateString('pt-BR', opt).replace('.', '');
        const endStr = last.toLocaleDateString('pt-BR', opt).replace('.', '');
        return `${startStr} - ${endStr}`;
    };

    const getDayLabel = (dateStr: string) => {
        const date = new Date(dateStr + 'T12:00:00');
        const weekDay = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
        const dayNum = date.getDate();
        return { weekDay, dayNum };
    };

    // --- Custom Date Picker Logic ---
    const toggleDatePicker = () => {
        if (!isDatePickerOpen) {
            // Sync picker month with currently selected date when opening
            setPickerMonth(new Date(selectedDate + 'T12:00:00'));
        }
        setIsDatePickerOpen(!isDatePickerOpen);
    };

    const changePickerMonth = (offset: number) => {
        const newDate = new Date(pickerMonth);
        newDate.setMonth(newDate.getMonth() + offset);
        setPickerMonth(newDate);
    };

    const handleDaySelect = (day: number) => {
        const year = pickerMonth.getFullYear();
        const month = pickerMonth.getMonth();
        // Construct simplified date string YYYY-MM-DD using local time concept
        const newDate = new Date(year, month, day);
        // Adjust for timezone offset to ensure string is correct yyyy-mm-dd
        const offset = newDate.getTimezoneOffset();
        const adjustedDate = new Date(newDate.getTime() - (offset * 60 * 1000));
        const dateStr = adjustedDate.toISOString().split('T')[0];

        setSelectedDate(dateStr);
        setIsDatePickerOpen(false);
    };

    // Generate calendar grid
    const getCalendarDays = () => {
        const year = pickerMonth.getFullYear();
        const month = pickerMonth.getMonth();

        const firstDay = new Date(year, month, 1).getDay(); // 0-6
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        // Empty slots for days before start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        return days;
    };

    // --- Actions ---

    const openPaymentModal = (apt: Appointment) => {
        setCurrentAppointment(apt);
        setPaymentDraft(apt.payments);
        setNotesInputValue(apt.notes || '');

        // Reset Cost Edit State
        setIsEditingCost(false);
        setCostInputValue(apt.cost.toFixed(2).replace('.', ','));

        // Reset Procedure Edit State
        setIsEditingProcedure(false);
        setProcedureInputValue(apt.procedure);

        // Reset Date/Time Edit State
        setIsEditingDateTime(false);
        setDateInputValue(apt.date);
        setTimeInputValue(apt.time);

        const alreadyPaid = apt.payments.reduce((acc, p) => acc + p.value, 0);
        const remaining = apt.cost - alreadyPaid;
        setCurrentValue(remaining > 0 ? remaining.toFixed(2).replace('.', ',') : '');
        setCurrentMethod('Pix');
        setCurrentInstallments(1);
        setStatusInputValue(apt.status);
        setIsModalOpen(true);
    };

    const closePaymentModal = () => {
        setIsModalOpen(false);
        setCurrentAppointment(null);
        setPaymentDraft([]);
    };

    // Cost Editing Actions
    const handleCostInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value === '') {
            setCostInputValue('0,00');
            return;
        }
        value = (Number(value) / 100).toFixed(2) + '';
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        setCostInputValue(value);
    };

    const handleCurrentValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value === '') {
            setCurrentValue('0,00');
            return;
        }
        // Limit to 2 decimal places
        value = (Number(value) / 100).toFixed(2) + '';
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        setCurrentValue(value);
    };

    const saveNewCost = () => {
        if (!currentAppointment) return;
        const newCost = parseCurrency(costInputValue);

        // Update local state for immediate feedback
        setCurrentAppointment({ ...currentAppointment, cost: newCost });
        setIsEditingCost(false);

        // Recalculate remaining for payment input
        const totalPaid = paymentDraft.reduce((acc, p) => acc + p.value, 0);
        const newRemaining = newCost - totalPaid;
        setCurrentValue(newRemaining > 0 ? newRemaining.toFixed(2).replace('.', ',') : '');
    };

    // Procedure Editing Actions
    const saveNewProcedure = () => {
        if (!currentAppointment) return;
        if (!procedureInputValue.trim()) {
            notify.warning('O nome do procedimento não pode estar vazio.');
            return;
        }
        setCurrentAppointment({ ...currentAppointment, procedure: procedureInputValue });
        setIsEditingProcedure(false);
        notify.success('Procedimento atualizado!');
    };

    const saveNewDateTime = () => {
        if (!currentAppointment) return;
        if (!dateInputValue || !timeInputValue) {
            notify.warning('Data e hora são obrigatórios.');
            return;
        }
        setCurrentAppointment({ ...currentAppointment, date: dateInputValue, time: timeInputValue });
        setIsEditingDateTime(false);
        notify.success('Data/Hora atualizada!');
    };

    const addPaymentPart = () => {
        if (!currentAppointment) return;
        let val = parseCurrency(currentValue);
        if (val <= 0) return;

        const totalPaidDraft = paymentDraft.reduce((acc, p) => acc + p.value, 0);
        const remaining = Math.max(0, currentAppointment.cost - totalPaidDraft);

        // Check if value exceeds remaining balance
        if (val > remaining + 0.01) {
            notify.error(`O valor informado (R$ ${val.toFixed(2)}) excede o saldo restante (R$ ${remaining.toFixed(2)}). Por favor, ajuste o valor ou edite o Valor Total acima.`);
            return;
        }

        if (val <= 0) {
            notify.info("O saldo restante para este agendamento já foi quitado.");
            return;
        }

        const newPart: PaymentPart = {
            id: Math.random().toString(36).substr(2, 9),
            method: currentMethod,
            value: val,
            installments: currentMethod === 'Cartão de Crédito' ? currentInstallments : undefined
        };

        const updatedDraft = [...paymentDraft, newPart];
        setPaymentDraft(updatedDraft);

        const newTotal = updatedDraft.reduce((acc, p) => acc + p.value, 0);
        const newRemaining = currentAppointment.cost - newTotal;
        setCurrentValue(newRemaining > 0 ? newRemaining.toFixed(2).replace('.', ',') : '');
        setCurrentInstallments(1);
    };

    const removePaymentPart = (id: string) => {
        setPaymentDraft(prev => prev.filter(p => p.id !== id));
    };

    const confirmFinishAppointment = async (targetStatus?: string) => {
        if (!currentAppointment) return;
        const statusToApply = targetStatus || statusInputValue;
        const totalPaid = paymentDraft.reduce((acc, p) => acc + p.value, 0);

        if (totalPaid > currentAppointment.cost + 0.01) {
            notify.error(`O total dos pagamentos (R$ ${totalPaid.toFixed(2)}) não pode exceder o custo total (R$ ${currentAppointment.cost.toFixed(2)}). Por favor, ajuste os valores.`);
            return;
        }

        // Only show payment warning for 'Atendido' status
        if (statusToApply === 'Atendido' && totalPaid < currentAppointment.cost - 0.01) {
            setConfirmModal({
                isOpen: true,
                title: 'Pagamento Incompleto',
                message: `O valor total pago (R$ ${totalPaid.toFixed(2)}) é menor que o custo (R$ ${currentAppointment.cost.toFixed(2)}). Deseja finalizar mesmo assim como "Pendente"?`,
                variant: 'warning',
                onConfirm: () => proceedWithFinish(totalPaid >= currentAppointment.cost - 0.01, statusToApply),
            });
            return;
        }

        proceedWithFinish(totalPaid >= currentAppointment.cost - 0.01, statusToApply);
    };

    const proceedWithFinish = async (isFullyPaid: boolean, targetStatus: string) => {
        if (!currentAppointment) return;

        const loadingToast = notify.loading('Salvando alterações...');

        try {
            await appointmentService.update(currentAppointment.id as string, {
                status: targetStatus,
                payment_status: targetStatus === 'Falhou' ? 'Não realizado' : (isFullyPaid ? 'Pago' : 'Pendente'),
                total_cost: currentAppointment.cost,
                procedure: currentAppointment.procedure,
                notes: notesInputValue,
                date: currentAppointment.date,
                time: currentAppointment.time
            });

            // Add new payments (those with mock IDs)
            for (const payment of paymentDraft) {
                // If ID is not a UUID (contains a dot from Math.random or is shorter), it's new
                if (payment.id.includes('.') || payment.id.length < 20) {
                    await appointmentService.addPayment({
                        appointment_id: currentAppointment.id,
                        method: payment.method,
                        value: payment.value,
                        installments: payment.installments
                    });
                }
            }

            notify.dismiss(loadingToast);
            notify.success('Atendimento finalizado com sucesso!');
            await fetchData();
            closePaymentModal();
        } catch (err) {
            console.error('Error finalizing appointment:', err);
            notify.dismiss(loadingToast);
            notify.error('Erro ao finalizar atendimento.');
        }
    };

    const handleFailAppointment = async (id: string | number) => {
        setConfirmModal({
            isOpen: true,
            title: 'Marcar como Falhou',
            message: 'Tem certeza que deseja marcar este agendamento como FALHOU?',
            variant: 'warning',
            onConfirm: async () => {
                try {
                    await appointmentService.update(String(id), { status: 'Falhou', payment_status: 'Não realizado' });
                    notify.success('Agendamento marcado como falhou.');
                    await fetchData();
                } catch (err) {
                    console.error('Error failing appointment:', err);
                    notify.error('Erro ao atualizar agendamento.');
                }
            },
        });
    };

    const handleDelete = async (apt: Appointment) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Agendamento',
            message: `Tem certeza que deseja excluir o agendamento de ${apt.patient}? Esta ação não pode ser desfeita.`,
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await appointmentService.delete(String(apt.id));
                    setAppointments(prev => prev.filter(a => String(a.id) !== String(apt.id)));
                    notify.success('Agendamento excluído com sucesso!');
                } catch (err) {
                    console.error('Error deleting appointment:', err);
                    notify.error('Erro ao excluir agendamento.');
                }
            },
        });
    };

    // Edit Modal Logic
    const [isEditInfoModalOpen, setIsEditInfoModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Appointment>>({});

    const openEditModal = (apt: Appointment) => {
        setEditForm({
            id: apt.id,
            date: apt.date,
            time: apt.time,
            provider: apt.provider,
            status: apt.status
        });
        setIsEditInfoModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editForm.id) return;
        try {
            await appointmentService.update(String(editForm.id), {
                date: editForm.date,
                time: editForm.time,
                provider: editForm.provider,
                status: editForm.status
            });
            await fetchData();
            notify.success('Agendamento atualizado com sucesso!');
            setIsEditInfoModalOpen(false);
        } catch (err) {
            console.error(err);
            notify.error('Erro ao editar agendamento.');
        }
    };

    const handleOpenPatientHistory = async (name: string, birthDate: string, phone: string) => {
        setSelectedPatientForHistory({ name, birthDate, phone });
        setPhoneInputValue(phone || '');
        setIsEditingPhone(false);
        setIsHistoryOpen(true);
        setIsFetchingHistory(true);
        try {
            const history = await appointmentService.getPatientHistory(name, birthDate);
            setPatientHistory(history);
        } catch (err) {
            console.error('Error fetching history:', err);
            notify.error('Erro ao buscar histórico do paciente.');
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleSavePhone = async () => {
        if (!selectedPatientForHistory) return;

        const loadingToast = notify.loading('Atualizando telefone...');

        try {
            // Update all appointments for this patient
            await appointmentService.updatePatientPhone(
                selectedPatientForHistory.name,
                selectedPatientForHistory.birthDate,
                phoneInputValue
            );

            // Update local state
            setSelectedPatientForHistory({
                ...selectedPatientForHistory,
                phone: phoneInputValue
            });

            setIsEditingPhone(false);
            notify.dismiss(loadingToast);
            notify.success('Telefone atualizado com sucesso!');

            // Refresh appointments list
            await fetchData();
        } catch (err) {
            console.error('Error updating phone:', err);
            notify.dismiss(loadingToast);
            notify.error('Erro ao atualizar telefone.');
        }
    };

    const formatPhoneInput = (value: string) => {
        // Remove all non-digits
        const digits = value.replace(/\D/g, '');

        // Format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
        if (digits.length <= 10) {
            return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
        }
        return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    };

    const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneInput(e.target.value);
        setPhoneInputValue(formatted);
    };

    const handleOpenAuditLog = async (appointmentId: string) => {
        if (!appointmentId) {
            notify.error('ID do agendamento não encontrado.');
            return;
        }

        setIsAuditLogOpen(true);
        setIsFetchingAuditLogs(true);
        setAuditLogs([]); // Clear previous logs

        try {
            const logs = await appointmentService.getAuditLogs(appointmentId);
            setAuditLogs(logs || []);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            notify.error('Erro ao buscar histórico de edições.');
            setAuditLogs([]);
        } finally {
            setIsFetchingAuditLogs(false);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // --- Renderers ---

    const renderStatus = (status: string) => <Badge status={status} />;

    const getStatusColorBorder = (status: string) => {
        switch (status) {
            case 'Agendado': return 'border-l-blue-500 bg-white dark:bg-slate-800';
            case 'Atendido': return 'border-l-green-500 bg-green-50/30 dark:bg-green-900/10';
            case 'Falhou': return 'border-l-red-500 bg-red-50/30 dark:bg-red-900/10 opacity-75';
            case 'Cancelado': return 'border-l-slate-400 bg-slate-50/50 dark:bg-slate-800 opacity-60';
            default: return 'border-l-slate-300';
        }
    };

    // FILTER LOGIC
    const checkHospitalFilter = (apt: Appointment) => {
        if (!hospitalFilter || hospitalFilter === 'Todos os Parceiros') return true;
        return apt.hospital === hospitalFilter;
    };

    // Filter List Data (Daily View)
    const filteredData = appointments.filter(apt => {
        if (apt.date !== selectedDate) return false;
        if (!checkHospitalFilter(apt)) return false; // Partner Filter

        if (activeFilter === 'Todos') return true;
        if (activeFilter === 'Consultas') return apt.type === 'CONSULTA';
        if (activeFilter === 'Exames') return apt.type === 'EXAME';
        if (activeFilter === 'Cirurgias') return apt.type === 'CIRURGIA';
        return true;
    }).sort((a, b) => a.time.localeCompare(b.time));

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter, hospitalFilter, selectedDate, itemsPerPage]);

    // Calendar Week Data
    const currentWeekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

    const getAppointmentsForDay = (dateStr: string) => {
        const localAppointments = appointments.filter(apt => apt.date === dateStr);

        const filteredDayData = localAppointments
            .filter((apt) => {
                const matchesCategory = activeFilter === 'Todos' || apt.type === activeFilter.toUpperCase();
                const matchesHospital = checkHospitalFilter(apt);
                return matchesCategory && matchesHospital;
            })
            .sort((a, b) => a.time.localeCompare(b.time));

        return filteredDayData;
    };

    return (
        <div className={`w-full max-w-[1600px] mx-auto space-y-6 pt-4 pb-12 ${isEmbedded ? '' : 'min-h-[calc(100vh-100px)]'}`}>

            {/* EDIT INFO MODAL */}
            {isEditInfoModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Editar Agendamento</h3>
                            <button onClick={() => setIsEditInfoModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Data</label>
                                <input
                                    type="date"
                                    value={editForm.date || ''}
                                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Horário</label>
                                <input
                                    type="time"
                                    value={editForm.time || ''}
                                    onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Médico</label>
                                <input
                                    type="text"
                                    value={editForm.provider || ''}
                                    onChange={e => setEditForm({ ...editForm, provider: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Status</label>
                                <select
                                    value={editForm.status || ''}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                                >
                                    <option value="Agendado">Agendado</option>
                                    <option value="Atendido">Atendido</option>
                                    <option value="Falhou">Falhou</option>
                                    <option value="Cancelado">Cancelado</option>
                                </select>
                            </div>
                            <button
                                onClick={handleSaveEdit}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors mt-2 shadow-lg shadow-green-600/20"
                            >
                                Salvar Alterações
                            </button>
                            <button
                                onClick={() => editForm.id && handleOpenAuditLog(String(editForm.id))}
                                className="w-full bg-slate-100 text-slate-500 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors mt-2 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">history</span>
                                Ver Histórico de Edições
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Controls - Hidden or Modified when Embedded */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
                {!isEmbedded && (
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Atendimentos</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie a agenda e os pagamentos.</p>
                    </div>
                )}

                {/* If embedded, we align filters to the left/start or fill. If standalone, we align to the right/end typically */}
                <div className={`flex flex-col sm:flex-row items-center gap-4 w-full ${isEmbedded ? 'xl:w-full' : 'xl:w-auto'}`}>

                    {/* Filter Tabs */}
                    <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm card-shadow border border-slate-200 dark:border-slate-700">
                        {['Todos', 'Consultas', 'Exames', 'Cirurgias'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeFilter === filter
                                    ? 'bg-slate-900 text-white shadow-sm dark:bg-primary'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Date Navigator & Custom Picker */}
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-1.5 shadow-sm card-shadow relative" ref={datePickerRef}>
                        <button onClick={() => navigateDate(-7)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500" title="Semana Anterior">
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>

                        <div
                            className="px-4 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors relative select-none border-x border-slate-200 dark:border-slate-700 mx-1"
                            onClick={toggleDatePicker}
                        >
                            <span className="material-symbols-outlined text-[20px] text-slate-400">calendar_month</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-white whitespace-nowrap min-w-[140px] text-center">
                                {getWeekRangeLabel(selectedDate)}
                            </span>
                        </div>

                        <button onClick={() => navigateDate(7)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500" title="Próxima Semana">
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>

                        {/* --- Custom Calendar Popover --- */}
                        {isDatePickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl p-6 z-50 w-[340px] animate-in fade-in zoom-in-95 duration-200">
                                {/* Calendar Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <button onClick={() => changePickerMonth(-1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-500">
                                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                                    </button>
                                    <span className="font-bold text-slate-900 dark:text-white capitalize text-lg">
                                        {pickerMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => changePickerMonth(1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-500">
                                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                    </button>
                                </div>

                                {/* Calendar Days Header */}
                                <div className="grid grid-cols-7 mb-3 text-center">
                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                        <div key={i} className="text-xs font-bold text-slate-400">{d}</div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-2">
                                    {getCalendarDays().map((day, i) => {
                                        if (day === null) return <div key={i}></div>;

                                        // Check if this day is the selected one
                                        const currentYear = pickerMonth.getFullYear();
                                        const currentMonth = pickerMonth.getMonth();
                                        const isSelected = new Date(selectedDate).getDate() === day &&
                                            new Date(selectedDate).getMonth() === currentMonth &&
                                            new Date(selectedDate).getFullYear() === currentYear;

                                        const isToday = new Date().getDate() === day &&
                                            new Date().getMonth() === currentMonth &&
                                            new Date().getFullYear() === currentYear;

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleDaySelect(day)}
                                                className={`
                                            h-9 w-9 rounded-xl flex items-center justify-center text-sm font-medium transition-all
                                            ${isSelected ? 'bg-primary text-white font-bold shadow-md shadow-primary/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}
                                            ${isToday && !isSelected ? 'border-2 border-primary text-primary font-bold' : ''}
                                        `}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                                    <button
                                        onClick={() => {
                                            setSelectedDate(new Date().toISOString().split('T')[0]);
                                            setIsDatePickerOpen(false);
                                        }}
                                        className="text-xs font-bold text-primary hover:underline bg-primary/5 px-4 py-2 rounded-xl"
                                    >
                                        Voltar para Hoje
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                        variant="ghost"
                        size="sm"
                    >
                        Hoje
                    </Button>

                    <Button
                        onClick={() => navigate('/new-appointment')}
                        icon="add"
                        variant="success"
                        className="ml-auto xl:ml-0"
                    >
                        <span className="hidden sm:inline">Agendar</span>
                    </Button>
                </div>
            </div>

            {/* --- CONTENT AREA (SPLIT VERTICAL) --- */}
            <div className={`flex-1 flex flex-col gap-6 ${isEmbedded ? '' : 'min-h-0'}`}>

                {/* TOP: CALENDAR GRID (Fixed height relative to viewport for overview) */}
                <Card noPadding className="h-[350px] shrink-0 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">calendar_view_week</span>
                            Visão Semanal
                        </h3>
                        {/* Interactive Hospital Selector for Admin, Indicator for others */}
                        <div className="flex items-center gap-2">
                            {!isEmbedded && user?.role === UserRole.ADMIN ? (
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:bg-white dark:hover:bg-slate-750">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">domain</span>
                                    <select
                                        value={selectedHospitalId}
                                        onChange={(e) => setSelectedHospitalId(e.target.value)}
                                        className="bg-transparent border-none p-0 text-[10px] font-black text-slate-600 dark:text-slate-300 focus:ring-0 cursor-pointer uppercase tracking-widest min-w-[120px]"
                                    >
                                        <option value="">Todos os Parceiros</option>
                                        {hospitalsList.map(h => (
                                            <option key={h.id} value={h.id}>{h.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                !isEmbedded && (
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">
                                        {user?.hospitalName || 'Todos os Parceiros'}
                                    </span>
                                )
                            )}

                            {user?.role === UserRole.ADMIN && selectedHospitalId && (
                                <button
                                    onClick={() => {
                                        setBlockForm({ ...blockForm, hospital_id: selectedHospitalId });
                                        setIsBlockModalOpen(true);
                                    }}
                                    className="p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 transition-all flex items-center gap-1.5"
                                    title="Configurar Bloqueios"
                                >
                                    <span className="material-symbols-outlined text-[18px]">block</span>
                                    <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Bloqueios</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 overflow-x-auto lg:overflow-x-hidden scrollbar-hide">
                        {/* Calendar Header */}
                        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 min-w-[700px] lg:min-w-0">
                            {currentWeekDays.map((dateStr) => {
                                const { weekDay, dayNum } = getDayLabel(dateStr);
                                const isSelected = dateStr === selectedDate;
                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={`py-3 px-2 text-center border-r border-slate-200 dark:border-slate-700 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isSelected ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                                    >
                                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isToday ? 'text-primary' : 'text-slate-400'}`}>{weekDay}</p>
                                        <div className={`text-xl font-black ${isToday ? 'text-primary' : (isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')} flex flex-col justify-center items-center`}>
                                            {dayNum}
                                            {isToday && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1"></div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Calendar Grid Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-auto lg:overflow-x-hidden bg-slate-50/30 dark:bg-slate-900/50 scrollbar-hide">
                            <div className="grid grid-cols-7 h-full min-w-[700px] lg:min-w-0 divide-x divide-slate-200 dark:divide-slate-700">
                                {currentWeekDays.map((dateStr) => {
                                    const dayAppointments = getAppointmentsForDay(dateStr);
                                    const isSelected = dateStr === selectedDate;
                                    const dayBlocks = scheduleBlocks.filter(b => {
                                        if (b.block_type === 'SPECIFIC_DAY') return b.date === dateStr;
                                        return b.day_of_week === new Date(dateStr + 'T12:00:00').getDay();
                                    });
                                    const fullDayBlock = dayBlocks.find(b => !b.start_time);
                                    const hasPartialBlocks = dayBlocks.some(b => b.start_time);

                                    return (
                                        <div
                                            key={dateStr}
                                            onClick={() => setSelectedDate(dateStr)}
                                            className={`border-r border-slate-200 dark:border-slate-700 last:border-0 p-2 space-y-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors relative ${isSelected ? 'bg-white dark:bg-slate-800/50' : ''} ${fullDayBlock ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                                        >
                                            {fullDayBlock && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                                                    <span className="material-symbols-outlined text-amber-500 text-[24px]">block</span>
                                                    <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tighter mt-1">{fullDayBlock.reason || 'Bloqueado'}</span>
                                                </div>
                                            )}
                                            {hasPartialBlocks && !fullDayBlock && (
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Horários Bloqueados</span>
                                                </div>
                                            )}
                                            {dayAppointments.length === 0 && !fullDayBlock && (
                                                <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100">
                                                    <span className="material-symbols-outlined text-slate-300 text-sm">add</span>
                                                </div>
                                            )}
                                            {dayAppointments.map((apt) => (
                                                <div
                                                    key={apt.id}
                                                    // Clicking an item in calendar selects the date AND opens modal
                                                    onClick={(e) => { e.stopPropagation(); openPaymentModal(apt); setSelectedDate(dateStr); }}
                                                    className={`p-2 rounded-xl border-l-4 text-[10px] shadow-sm hover:scale-[1.02] transition-transform bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-700 ${getStatusColorBorder(apt.status)}`}
                                                >
                                                    <div className="flex justify-between mb-1">
                                                        <span className="font-bold truncate text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{apt.time}</span>
                                                        {apt.status === 'Atendido' && <span className="material-symbols-outlined text-[12px] text-green-500">check_circle</span>}
                                                    </div>
                                                    <div className="font-bold truncate text-slate-900 dark:text-white leading-tight">{apt.patient}</div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* BOTTOM: LIST (Flexible height) */}
                <Card noPadding overflow="visible" className={`flex flex-col ${isEmbedded ? '' : 'flex-1 min-h-[500px]'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-6 border-b border-slate-200 dark:border-slate-700 gap-4">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-3 text-lg text-left">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 shrink-0">
                                <span className="material-symbols-outlined">list_alt</span>
                            </div>
                            <span className="leading-tight">Detalhes do Dia: <br className="sm:hidden" /><span className="text-primary">{getFormattedDate(selectedDate)}</span></span>
                        </h3>
                        <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exibir</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                    className="bg-transparent border-none text-xs font-black text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer p-0 pr-6"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                            <span className="text-[10px] font-black bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 rounded-lg shadow-sm shrink-0 uppercase tracking-widest">{filteredData.length} agendamentos</span>
                        </div>
                    </div>

                    <div className={`${isEmbedded ? '' : 'flex-1 overflow-y-auto'} pb-10`}>
                        {isLoading ? (
                            <div className="px-6 py-20 text-center text-slate-400">
                                <div className="flex flex-col items-center gap-3 animate-pulse">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                                    <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded"></div>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="px-6 py-20 text-center text-red-500">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl text-red-500">error</span>
                                    </div>
                                    <p className="font-medium text-slate-900 dark:text-white">{error}</p>
                                    <Button size="sm" onClick={fetchData} variant="ghost" className="text-primary hover:bg-primary/5">
                                        Tentar novamente
                                    </Button>
                                </div>
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="px-6 py-20 text-center text-slate-400">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl opacity-50">event_busy</span>
                                    </div>
                                    <p className="font-medium">Nenhum agendamento para este dia.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* UNIFIED RESPONSIVE VIEW (Modern Cards/List) */}
                                <div className="px-4 sm:px-6 flex flex-col gap-4 pt-4">
                                    {paginatedData.map((apt) => (
                                        <div
                                            key={apt.id}
                                            className="group bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 relative overflow-hidden"
                                        >
                                            {/* Left Status Bar */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${apt.status === 'Agendado' ? 'bg-blue-500' :
                                                apt.status === 'Atendido' ? 'bg-green-500' :
                                                    apt.status === 'Falhou' ? 'bg-red-500' : 'bg-slate-400'
                                                }`} />

                                            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                                                {/* Line 1: Main Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <div className="lg:hidden">
                                                            <Badge status={apt.status} />
                                                        </div>
                                                        <h4
                                                            className="font-bold text-slate-900 dark:text-white text-base sm:text-lg cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenPatientHistory(apt.patient, apt.patientBirthDate || '', apt.patientPhone || '');
                                                            }}
                                                        >
                                                            {apt.patient}
                                                            <span className="material-symbols-outlined text-[16px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">history</span>
                                                        </h4>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                                                        <div className="flex items-center gap-1.5 font-medium">
                                                            <span className="material-symbols-outlined text-[16px]">medical_services</span>
                                                            <span className="text-slate-900 dark:text-slate-200 font-bold">{apt.procedure}</span>
                                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-black uppercase text-slate-400">{apt.type}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[16px]">domain</span>
                                                            <span className="truncate max-w-[150px]">{apt.hospital}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[16px]">stethoscope</span>
                                                            <span>{apt.provider}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Line 2: Secondary Info (Time & Payment) */}
                                                <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 pt-3 lg:pt-0">
                                                    {/* Time - Subtle and De-emphasized */}
                                                    <div className="flex flex-col items-center lg:items-end">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Entrada/Hora</span>
                                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                            <span className="material-symbols-outlined text-[16px] lg:hidden">schedule</span>
                                                            <span className="font-bold text-sm bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700">{apt.time}</span>
                                                        </div>
                                                    </div>

                                                    {/* Payment/Value */}
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor</span>
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-slate-900 dark:text-white text-base leading-none">{formatCurrency(apt.cost)}</span>
                                                            <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter mt-1 px-1.5 py-0.5 rounded-md ${apt.paymentStatus === 'Pago'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                }`}>
                                                                <span className="material-symbols-outlined text-[10px] leading-none">{apt.paymentStatus === 'Pago' ? 'check_circle' : 'pending'}</span>
                                                                {apt.paymentStatus}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge - Hidden on small, shown on large */}
                                                    <div className="hidden lg:block">
                                                        <Badge status={apt.status} />
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center justify-end gap-2 shrink-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 pt-3 lg:pt-0">
                                                    <div className="flex items-center gap-2">
                                                        {apt.status === 'Agendado' ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    onClick={(e) => { e.stopPropagation(); openPaymentModal(apt); }}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 shadow-sm px-4 rounded-xl text-xs"
                                                                >
                                                                    Confirmar
                                                                </Button>
                                                                <Button
                                                                    onClick={(e) => { e.stopPropagation(); handleFailAppointment(apt.id); }}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 rounded-xl text-xs"
                                                                >
                                                                    Falhou
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                onClick={(e) => { e.stopPropagation(); openPaymentModal(apt); }}
                                                                variant="ghost"
                                                                size="sm"
                                                                icon="edit"
                                                                className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 rounded-xl text-xs"
                                                            >
                                                                Editar
                                                            </Button>
                                                        )}

                                                        <Button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(apt); }}
                                                            variant="ghost"
                                                            size="sm"
                                                            icon="delete"
                                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                                                            title="Excluir"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="px-6 py-6 flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800 gap-4">
                                        <p className="text-xs font-bold text-slate-400">
                                            Mostrando <span className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span className="text-slate-900 dark:text-white">{filteredData.length}</span> resultados
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <span className="material-symbols-outlined">chevron_left</span>
                                            </button>

                                            {[...Array(totalPages)].map((_, i) => {
                                                const pageNum = i + 1;
                                                // Only show current, first, last, and pages around current
                                                if (
                                                    pageNum === 1 ||
                                                    pageNum === totalPages ||
                                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === pageNum
                                                                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                }
                                                if (
                                                    (pageNum === 2 && currentPage > 3) ||
                                                    (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                                ) {
                                                    return <span key={pageNum} className="px-2 text-slate-300">...</span>;
                                                }
                                                return null;
                                            })}

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <span className="material-symbols-outlined">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>

            </div>

            {/* --- PAYMENT MODAL --- */}
            {
                isModalOpen && currentAppointment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">

                            {/* Modal Header */}
                            <div className="p-8 pb-6 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                                        Editar Atendimento
                                    </h2>
                                    <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2">
                                        <span>Paciente: <span className="text-slate-600 dark:text-slate-300">{currentAppointment.patient}</span></span>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        {isEditingDateTime ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={dateInputValue}
                                                    onChange={(e) => setDateInputValue(e.target.value)}
                                                    className="h-8 px-2 rounded-lg border border-primary text-xs font-bold bg-white dark:bg-slate-800"
                                                />
                                                <input
                                                    type="time"
                                                    value={timeInputValue}
                                                    onChange={(e) => setTimeInputValue(e.target.value)}
                                                    className="h-8 px-2 rounded-lg border border-primary text-xs font-bold bg-white dark:bg-slate-800"
                                                />
                                                <button onClick={saveNewDateTime} className="p-1 bg-green-500 text-white rounded-md"><span className="material-symbols-outlined text-[16px]">check</span></button>
                                                <button onClick={() => setIsEditingDateTime(false)} className="p-1 bg-red-100 text-red-500 rounded-md"><span className="material-symbols-outlined text-[16px]">close</span></button>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 flex items-center gap-1 group cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingDateTime(true)}>
                                                {currentAppointment.date ? currentAppointment.date.split('-').reverse().join('/') : selectedDate.split('-').reverse().join('/')}
                                                <span className="text-slate-400 dark:text-slate-500 pl-1">às {currentAppointment.time}</span>
                                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100">edit</span>
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* History Icon Button */}
                                    <button
                                        onClick={() => currentAppointment.id && handleOpenAuditLog(String(currentAppointment.id))}
                                        className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        title="Ver Histórico de Edições"
                                    >
                                        <span className="material-symbols-outlined text-[24px]">history</span>
                                    </button>
                                    <button onClick={closePaymentModal} className="text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-[28px]">close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">

                                {/* Top Grid: Procedure and Total Cost */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    {/* Procedure Name */}
                                    <div className="md:col-span-8 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Procedimento</p>
                                        {isEditingProcedure ? (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={procedureInputValue}
                                                    onChange={(e) => setProcedureInputValue(e.target.value)}
                                                    autoFocus
                                                    className="flex-1 h-9 px-2 rounded-lg border border-primary text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 focus:outline-none"
                                                >
                                                    <option value="">Selecione um procedimento</option>
                                                    {procedures.map((proc) => (
                                                        <option key={proc.id} value={proc.name}>{proc.name}</option>
                                                    ))}
                                                </select>
                                                <button onClick={saveNewProcedure} className="p-1.5 bg-green-500 text-white rounded-lg"><span className="material-symbols-outlined text-[18px]">check</span></button>
                                                <button onClick={() => setIsEditingProcedure(false)} className="p-1.5 bg-red-100 text-red-500 rounded-lg"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center">
                                                <p className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                                                    {currentAppointment.procedure}
                                                </p>
                                                <button onClick={() => setIsEditingProcedure(true)} className="text-slate-300 hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Total Value */}
                                    <div className="md:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm relative">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                                        {isEditingCost ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={costInputValue}
                                                    onChange={handleCostInputChange}
                                                    autoFocus
                                                    className="w-full h-9 px-2 rounded-lg border border-primary text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none"
                                                />
                                                <button onClick={saveNewCost} className="p-1.5 bg-green-500 text-white rounded-lg"><span className="material-symbols-outlined text-[18px]">check</span></button>
                                                <button onClick={() => setIsEditingCost(false)} className="p-1.5 bg-red-100 text-red-500 rounded-lg"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center">
                                                <p className="text-lg font-black text-slate-800 dark:text-white">
                                                    {formatCurrency(currentAppointment.cost)}
                                                </p>
                                                <button onClick={() => setIsEditingCost(true)} className="text-slate-300 hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section: Add Payment */}
                                <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                        <span className="material-symbols-outlined text-[16px]">payments</span>
                                        Adicionar Pagamento
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">Método</label>
                                            <div className="relative">
                                                <select
                                                    value={currentMethod}
                                                    onChange={(e) => {
                                                        setCurrentMethod(e.target.value);
                                                        setCurrentInstallments(1);
                                                    }}
                                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm"
                                                >
                                                    {hospitalPaymentMethods.map((m) => (
                                                        <option key={m.id} value={m.name}>{m.name}</option>
                                                    ))}
                                                    {hospitalPaymentMethods.length === 0 && (
                                                        <>
                                                            <option value="Pix">Pix</option>
                                                            <option value="Dinheiro">Dinheiro</option>
                                                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                                                            <option value="Cartão de Débito">Cartão de Débito</option>
                                                        </>
                                                    )}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
                                            </div>
                                        </div>

                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">Parcelas</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={currentInstallments}
                                                onChange={(e) => setCurrentInstallments(Math.max(1, parseInt(e.target.value) || 1))}
                                                disabled={currentMethod !== 'Cartão de Crédito'}
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary/20 shadow-sm disabled:opacity-50"
                                            />
                                        </div>

                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">Valor (R$)</label>
                                            <input
                                                type="text"
                                                value={currentValue}
                                                onChange={handleCurrentValueChange}
                                                placeholder="0,00"
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary/20 shadow-sm"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <button
                                                onClick={addPaymentPart}
                                                className="w-full h-11 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg"
                                            >
                                                <span className="material-symbols-outlined">add</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Registered Payments */}
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagamentos Registrados</h4>
                                        <p className="text-xs font-bold text-slate-400">Total pago: <span className="text-green-600 font-black">{formatCurrency(paymentDraft.reduce((acc, p) => acc + p.value, 0))}</span></p>
                                    </div>

                                    {paymentDraft.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-300 text-xs font-bold">
                                            Nenhum pagamento registrado
                                        </div>
                                    ) : (
                                        <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
                                            {paymentDraft.map((pay) => (
                                                <div key={pay.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${pay.method === 'Pix' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'
                                                            }`}>
                                                            <span className="material-symbols-outlined text-[20px]">
                                                                {pay.method === 'Pix' ? 'qr_code_2' :
                                                                    pay.method === 'Dinheiro' ? 'attach_money' : 'credit_card'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">{pay.method}</p>
                                                            <p className="text-[10px] font-bold text-slate-400">02/01/2026 às 14:30</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-5">
                                                        <div className="text-right">
                                                            <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(pay.value)}</p>
                                                            <p className="text-[10px] font-bold text-slate-400">{pay.installments || 1}x parcela</p>
                                                        </div>
                                                        <button onClick={() => removePaymentPart(pay.id)} className="text-slate-200 hover:text-red-500 transition-colors">
                                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section: Notes (Collapsible) */}
                                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <span className="material-symbols-outlined text-slate-400 text-[20px]">notes</span>
                                                {notesInputValue.trim() && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
                                                )}
                                            </div>
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Observações do Atendimento</span>
                                            {notesInputValue.trim() && (
                                                <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 text-[8px] font-black uppercase tracking-tighter animate-in fade-in zoom-in duration-300">
                                                    Conteúdo
                                                </span>
                                            )}
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-300 transition-transform duration-300 ${isNotesExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>
                                    <div className={`transition-all duration-300 ease-in-out ${isNotesExpanded ? 'max-h-[200px] p-4 pt-0' : 'max-h-0'}`}>
                                        <textarea
                                            value={notesInputValue}
                                            onChange={(e) => setNotesInputValue(e.target.value)}
                                            placeholder="Digite aqui observações importantes sobre este paciente ou atendimento..."
                                            className="w-full h-24 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-primary/10 text-sm p-3 placeholder-slate-400 font-medium text-slate-700 dark:text-slate-300 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-8 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-center gap-3">
                                <button
                                    onClick={closePaymentModal}
                                    className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                >
                                    Cancelar
                                </button>

                                {currentAppointment.status === 'Agendado' ? (
                                    <>
                                        <button
                                            onClick={() => confirmFinishAppointment('Falhou')}
                                            className="flex-1 py-3.5 rounded-2xl bg-red-50 text-red-500 font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">block</span>
                                            Falhou
                                        </button>
                                        <button
                                            onClick={() => confirmFinishAppointment('Agendado')}
                                            className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                        >
                                            Salvar
                                        </button>
                                        <button
                                            onClick={() => confirmFinishAppointment('Atendido')}
                                            className="flex-[1.5] py-3.5 rounded-2xl bg-[#009366] text-white font-black hover:opacity-90 transition-all shadow-lg shadow-green-200 dark:shadow-none flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            Confirmar
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => confirmFinishAppointment()}
                                        className="flex-[1.5] py-3.5 rounded-2xl bg-green-600 text-white font-black hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">save</span>
                                        Atualizar Dados
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />

            {/* Patient History Modal */}
            {
                isHistoryOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-end animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
                        <div className="relative w-full max-w-2xl h-screen bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                            <div className="bg-white dark:bg-slate-900 p-8 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="size-16 rounded-3xl bg-primary text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-primary/20">
                                            {selectedPatientForHistory && getInitials(selectedPatientForHistory.name)}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedPatientForHistory?.name}</h2>
                                            <div className="flex items-center gap-3 mt-1">
                                                <Badge status="Atendido" />
                                                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">id_card</span>
                                                    Prontuário Digital
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsHistoryOpen(false)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative group min-h-[82px] flex flex-col justify-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefone</p>
                                        {isEditingPhone ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={phoneInputValue}
                                                    onChange={handlePhoneInputChange}
                                                    placeholder="(00) 00000-0000"
                                                    maxLength={15}
                                                    autoFocus
                                                    className="w-full h-9 px-2 rounded-lg border border-primary text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={handleSavePhone} className="flex-1 h-8 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                        <span className="material-symbols-outlined text-[16px]">check</span>
                                                        Salvar
                                                    </button>
                                                    <button onClick={() => { setIsEditingPhone(false); setPhoneInputValue(selectedPatientForHistory?.phone || ''); }} className="flex-1 h-8 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                                        Sair
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatientForHistory?.phone || 'Não informado'}</p>
                                                <button
                                                    onClick={() => setIsEditingPhone(true)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                                    title="Editar telefone"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nascimento</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatientForHistory?.birthDate || 'Não informado'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">history</span>
                                    Histórico do Paciente
                                </h3>
                                <div className="space-y-6">
                                    {isFetchingHistory ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="h-32 rounded-3xl bg-white dark:bg-slate-900 animate-pulse border border-slate-100 dark:border-slate-800" />
                                        ))
                                    ) : patientHistory.length > 0 ? (
                                        patientHistory.map((item, idx) => (
                                            <div key={idx} className="relative pl-10 before:content-[''] before:absolute before:left-[19px] before:top-8 before:bottom-[-24px] before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800 last:before:hidden">
                                                <div className="absolute left-0 top-2 size-10 rounded-full bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-slate-950 flex items-center justify-center z-10 shadow-sm">
                                                    <div className={`size-3 rounded-full ${item.status === 'Atendido' ? 'bg-green-500' : 'bg-primary'}`}></div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                                                        <div>
                                                            <p className="text-xs font-black text-primary uppercase tracking-widest">{item.date} • {item.time?.substring(0, 5)}</p>
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
                                        <div className="text-center py-10 text-slate-500 font-bold">Nenhum histórico encontrado.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Audit Log Modal */}
            {
                isAuditLogOpen && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] border border-slate-200 dark:border-slate-700">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">history</span>
                                        Histórico de Edições
                                    </h3>
                                    <p className="text-xs text-slate-500 font-bold mt-1">
                                        Registro de alterações deste agendamento
                                    </p>
                                </div>
                                <button onClick={() => setIsAuditLogOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {isFetchingAuditLogs ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-xs font-bold text-slate-400">Carregando histórico...</p>
                                    </div>
                                ) : auditLogs.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 font-bold text-sm">
                                        Nenhuma alteração registrada.
                                    </div>
                                ) : (
                                    auditLogs.map((log) => (
                                        <div key={log.id} className="relative pl-6 pb-6 border-l-2 border-slate-100 dark:border-slate-800 last:pb-0 last:border-0">
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900"></div>
                                            <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2">
                                                <span>{new Date(log.changed_at).toLocaleString('pt-BR')}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                {/* Display user name if available, otherwise fallback to email or 'Usuário' */}
                                                <span>{log.user?.name || log.user?.email || 'Usuário'}</span>
                                            </div>

                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                                                {Object.entries(log.changes || {}).map(([field, change]: [string, any]) => (
                                                    <div key={field} className="text-sm">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{field.replace(/_/g, ' ')}:</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs line-through opacity-70">
                                                                {String(change.from !== null && change.from !== undefined ? change.from : 'Vazio')}
                                                            </span>
                                                            <span className="material-symbols-outlined text-slate-400 text-[14px]">arrow_right_alt</span>
                                                            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded text-xs font-bold">
                                                                {String(change.to !== null && change.to !== undefined ? change.to : 'Vazio')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* --- SCHEDULE BLOCKS MODAL --- */}
            {isBlockModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500">block</span>
                                    Bloqueios de Agenda
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-widest">Configurar dias e horários indisponíveis</p>
                            </div>
                            <button onClick={() => setIsBlockModalOpen(false)} className="size-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors flex items-center justify-center">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* New Block Form */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Novo Bloqueio</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Tipo de Bloqueio</label>
                                        <div className="flex p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <button
                                                onClick={() => setBlockForm({ ...blockForm, block_type: 'SPECIFIC_DAY' })}
                                                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${blockForm.block_type === 'SPECIFIC_DAY' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                Dia Específico (Ex: Feriado)
                                            </button>
                                            <button
                                                onClick={() => setBlockForm({ ...blockForm, block_type: 'WEEKLY_RECURRING' })}
                                                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${blockForm.block_type === 'WEEKLY_RECURRING' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                Recorrente Semanal
                                            </button>
                                        </div>
                                    </div>

                                    {blockForm.block_type === 'SPECIFIC_DAY' ? (
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Data</label>
                                            <input
                                                type="date"
                                                value={blockForm.date}
                                                onChange={e => setBlockForm({ ...blockForm, date: e.target.value })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Dia da Semana</label>
                                            <select
                                                value={blockForm.day_of_week}
                                                onChange={e => setBlockForm({ ...blockForm, day_of_week: Number(e.target.value) })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-amber-500"
                                            >
                                                <option value={0}>Domingo</option>
                                                <option value={1}>Segunda-feira</option>
                                                <option value={2}>Terça-feira</option>
                                                <option value={3}>Quarta-feira</option>
                                                <option value={4}>Quinta-feira</option>
                                                <option value={5}>Sexta-feira</option>
                                                <option value={6}>Sábado</option>
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Motivo / Descrição</label>
                                        <input
                                            type="text"
                                            value={blockForm.reason}
                                            onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                                            placeholder="Ex: Feriado Municipal, Manutenção, etc."
                                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Início (Opcional)</label>
                                        <input
                                            type="time"
                                            value={blockForm.start_time || ''}
                                            onChange={e => setBlockForm({ ...blockForm, start_time: e.target.value })}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Fim (Opcional)</label>
                                        <input
                                            type="time"
                                            value={blockForm.end_time || ''}
                                            onChange={e => setBlockForm({ ...blockForm, end_time: e.target.value })}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div className="md:col-span-2 pt-2">
                                        <button
                                            onClick={handleSaveBlock}
                                            disabled={isSavingBlock}
                                            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSavingBlock ? 'Salvando...' : (<><span className="material-symbols-outlined">add_circle</span> Criar Bloqueio</>)}
                                        </button>
                                        <p className="text-[10px] text-slate-400 text-center mt-3 font-bold uppercase tracking-widest">Dica: Deixe os horários em branco para bloquear o dia inteiro.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Blocks List */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Bloqueios Ativos</h4>
                                {scheduleBlocks.length > 0 ? (
                                    <div className="grid gap-3">
                                        {scheduleBlocks.map((block) => (
                                            <div key={block.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-amber-500/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            {block.block_type === 'SPECIFIC_DAY' ? 'event' : 'event_repeat'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-black text-slate-900 dark:text-white text-sm">
                                                                {block.block_type === 'SPECIFIC_DAY'
                                                                    ? (block.date ? new Date(block.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-')
                                                                    : ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][block.day_of_week || 0]
                                                                }
                                                            </p>
                                                            {block.start_time && (
                                                                <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg uppercase">
                                                                    {block.start_time.substring(0, 5)} - {block.end_time?.substring(0, 5)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-bold">{block.reason || 'Sem motivo especificado'}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteBlock(block.id)}
                                                    className="size-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-4xl text-slate-200">event_available</span>
                                        <p className="text-slate-400 font-bold text-sm mt-2">Nenhum bloqueio configurado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendances;