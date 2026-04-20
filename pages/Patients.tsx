import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { formatCurrency, formatDate, formatPhoneMask, isValidPhone } from '../utils/formatters';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useNotification } from '../hooks/useNotification';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { ConfirmModal } from '../components/ConfirmModal';

interface PatientRecord {
    id?: string;
    name: string;
    phone: string;
    birthDate: string;
    hospital_id: string;
    hospital_name: string;
    history?: string[];
}

const Patients: React.FC = () => {
    const { user } = useAuth();
    const notify = useNotification();
    const [patients, setPatients] = useState<PatientRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchMode, setSearchMode] = useState<'name' | 'phone' | 'birthDate'>('name');
    const [selectedHospital, setSelectedHospital] = useState('Todos os Hospitais');
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'rows'>('rows');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const ITEMS_PER_PAGE = 12;
    const [currentPage, setCurrentPage] = useState(1);

    const AVAILABLE_TAGS = ['CONSULTA', 'CIRURGIA', 'EXAMES', 'RETORNO', 'AGENDADO', 'FALHOU'];

    // History Modal State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    // Phone Editing State
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [phoneInputValue, setPhoneInputValue] = useState('');
    const [isEditingHospital, setIsEditingHospital] = useState(false);
    const [hospitalInputValue, setHospitalInputValue] = useState('');

    // Name & BirthDate Editing State
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInputValue, setNameInputValue] = useState('');
    const [isEditingBirthDate, setIsEditingBirthDate] = useState(false);
    const [birthDateInputValue, setBirthDateInputValue] = useState('');

    // Merge Modal State
    const [isMergeOpen, setIsMergeOpen] = useState(false);
    const [mergeSearchPrimary, setMergeSearchPrimary] = useState('');
    const [mergeSearchDuplicate, setMergeSearchDuplicate] = useState('');
    const [mergePrimary, setMergePrimary] = useState<PatientRecord | null>(null);
    const [mergeDuplicate, setMergeDuplicate] = useState<PatientRecord | null>(null);
    const [isMerging, setIsMerging] = useState(false);
    const [showMergeConfirm, setShowMergeConfirm] = useState(false);

    const isFullAccess = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.COMMERCIAL;

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hospitalArr = await hospitalService.getAll();
            setHospitals(hospitalArr);

            const effectiveHospitalId = (!isFullAccess) ? user?.hospitalId : (selectedHospital !== 'Todos os Hospitais' ? hospitalArr.find(h => h.name === selectedHospital)?.id : undefined);

            const data = await appointmentService.getPatientRecords({
                hospitalId: effectiveHospitalId,
                searchTerm: searchTerm.length > 2 ? searchTerm : undefined
            });
            setPatients(data);
        } catch (err) {
            console.error('Error fetching patients:', err);
            notify.error('Erro ao carregar lista de pacientes.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        fetchData();
    }, [selectedHospital, searchTerm]);

    const filteredPatients = useMemo(() => {
        if (selectedTags.length === 0) return patients;
        return patients.filter(p => {
            // Check if patient's history has AT LEAST ONE of the selected tags (OR logic)
            // Or use EVERY (AND logic)? We will use OR logic here so they can see all FALHOU + AGENDADO
            return p.history && p.history.some(h => {
                const historyUpper = h.toUpperCase();
                return selectedTags.some(tag => historyUpper.includes(tag));
            });
        });
    }, [patients, selectedTags]);

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
        setCurrentPage(1);
    };

    const handleOpenHistory = async (patient: PatientRecord) => {
        setSelectedPatient(patient);
        setPhoneInputValue(patient.phone || '');
        setIsEditingPhone(false);
        setNameInputValue(patient.name || '');
        setIsEditingName(false);
        setBirthDateInputValue(patient.birthDate || '');
        setIsEditingBirthDate(false);
        setHospitalInputValue(patient.hospital_id || '');
        setIsEditingHospital(false);
        setIsHistoryOpen(true);
        setIsFetchingHistory(true);
        try {
            const scopedHospitalId = !isFullAccess ? user?.hospitalId : undefined;
            const data = await appointmentService.getPatientHistory(patient.name, patient.birthDate, patient.id, scopedHospitalId);
            setHistory(data);
        } catch (err) {
            console.error('Error fetching history:', err);
            notify.error('Erro ao carregar histórico.');
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleSaveNameAndBirthDate = async () => {
        if (!selectedPatient) return;
        if (!nameInputValue.trim()) {
            notify.warning('O nome não pode estar vazio.');
            return;
        }

        const loadingToast = notify.loading('Atualizando cadastro...');

        try {
            await appointmentService.updatePatientNameAndBirthDate(
                selectedPatient.name,
                selectedPatient.birthDate,
                nameInputValue.trim(),
                birthDateInputValue,
                selectedPatient.id
            );

            const updatedPatient = {
                ...selectedPatient,
                name: nameInputValue.trim(),
                birthDate: birthDateInputValue
            };
            setSelectedPatient(updatedPatient);
            setIsEditingName(false);
            setIsEditingBirthDate(false);
            notify.dismiss(loadingToast);
            notify.success('Cadastro atualizado com sucesso!');

            await fetchData();
        } catch (err) {
            console.error('Error updating patient:', err);
            notify.dismiss(loadingToast);
            notify.error('Erro ao atualizar cadastro.');
        }
    };

    const handleSavePhone = async () => {
        if (!selectedPatient) return;
        if (phoneInputValue && !isValidPhone(phoneInputValue)) {
            notify.warning('Telefone inválido. Use o formato (XX) XXXXX-XXXX com DDD.');
            return;
        }

        const loadingToast = notify.loading('Atualizando telefone...');

        try {
            await appointmentService.updatePatientPhone(
                selectedPatient.name,
                selectedPatient.birthDate,
                phoneInputValue
            );

            setSelectedPatient({
                ...selectedPatient,
                phone: phoneInputValue
            });

            setIsEditingPhone(false);
            notify.dismiss(loadingToast);
            notify.success('Telefone atualizado com sucesso!');

            // Refresh main list
            await fetchData();
        } catch (err) {
            console.error('Error updating phone:', err);
            notify.dismiss(loadingToast);
            notify.error('Erro ao atualizar telefone.');
        }
    };

    const handleSaveHospital = async () => {
        if (!selectedPatient) return;
        if (!hospitalInputValue) {
            notify.warning('Selecione um hospital para atualizar.');
            return;
        }

        const loadingToast = notify.loading('Atualizando hospital...');

        try {
            await appointmentService.updatePatientHospital(
                selectedPatient.name,
                selectedPatient.birthDate,
                hospitalInputValue
            );

            const selectedHospitalName = hospitals.find(h => h.id === hospitalInputValue)?.name || '';
            setSelectedPatient({
                ...selectedPatient,
                hospital_id: hospitalInputValue,
                hospital_name: selectedHospitalName
            });

            setIsEditingHospital(false);
            notify.dismiss(loadingToast);
            notify.success('Hospital atualizado com sucesso!');

            await fetchData();
        } catch (err) {
            console.error('Error updating hospital:', err);
            notify.dismiss(loadingToast);
            notify.error('Erro ao atualizar hospital.');
        }
    };

    const handleOpenMerge = () => {
        setMergeSearchPrimary('');
        setMergeSearchDuplicate('');
        setMergePrimary(null);
        setMergeDuplicate(null);
        setIsMergeOpen(true);
    };

    const handleSwapMerge = () => {
        const temp = mergePrimary;
        setMergePrimary(mergeDuplicate);
        setMergeDuplicate(temp);
        const tempSearch = mergeSearchPrimary;
        setMergeSearchPrimary(mergeSearchDuplicate);
        setMergeSearchDuplicate(tempSearch);
    };

    const handleConfirmMerge = async () => {
        if (!mergePrimary || !mergeDuplicate) return;

        setIsMerging(true);
        const loadingToast = notify.loading('Mesclando pacientes...');

        try {
            await appointmentService.mergePatients(
                { name: mergePrimary.name, birthDate: mergePrimary.birthDate, id: mergePrimary.id },
                { name: mergeDuplicate.name, birthDate: mergeDuplicate.birthDate, id: mergeDuplicate.id }
            );

            notify.dismiss(loadingToast);
            notify.success(`Paciente "${mergeDuplicate.name}" foi mesclado com "${mergePrimary.name}" com sucesso!`);
            setIsMergeOpen(false);
            setMergePrimary(null);
            setMergeDuplicate(null);
            await fetchData();
        } catch (err) {
            console.error('Error merging patients:', err);
            notify.dismiss(loadingToast);
            notify.error('Erro ao mesclar pacientes. Tente novamente.');
        } finally {
            setIsMerging(false);
        }
    };

    const mergeFilteredPrimary = useMemo(() => {
        if (mergeSearchPrimary.length < 2) return [];
        return patients.filter(p =>
            p.name.toLowerCase().includes(mergeSearchPrimary.toLowerCase()) &&
            (!mergeDuplicate || p.name !== mergeDuplicate.name || p.birthDate !== mergeDuplicate.birthDate)
        ).slice(0, 5);
    }, [patients, mergeSearchPrimary, mergeDuplicate]);

    const mergeFilteredDuplicate = useMemo(() => {
        if (mergeSearchDuplicate.length < 2) return [];
        return patients.filter(p =>
            p.name.toLowerCase().includes(mergeSearchDuplicate.toLowerCase()) &&
            (!mergePrimary || p.name !== mergePrimary.name || p.birthDate !== mergePrimary.birthDate)
        ).slice(0, 5);
    }, [patients, mergeSearchDuplicate, mergePrimary]);

    const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneInputValue(formatPhoneMask(e.target.value));
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getHistoryBadgeClass = (type: string) => {
        const colors: Record<string, string> = {
            'CONSULTA': 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400 border-teal-100 dark:border-teal-500/20',
            'CIRURGIA': 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border-purple-100 dark:border-purple-500/20',
            'EXAMES': 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border-orange-100 dark:border-orange-500/20',
            'RETORNO': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
            'FALHOU': 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20',
            'AGENDADO': 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border-sky-100 dark:border-sky-500/20'
        };

        let baseType = type;
        if (type.includes('RETORNO')) baseType = 'RETORNO';
        else if (type.includes('CONSULTA')) baseType = 'CONSULTA';
        else if (type.includes('CIRURGIA')) baseType = 'CIRURGIA';
        else if (type.includes('EXAME')) baseType = 'EXAMES';
        else if (type.includes('FALHOU')) baseType = 'FALHOU';
        else if (type.includes('AGENDADO')) baseType = 'AGENDADO';

        return colors[baseType] || 'bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-100 dark:border-slate-500/20';
    };

    const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedPatients = filteredPatients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-8 relative animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">Pacientes</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Histórico e registros únicos de pacientes.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {isLoading && <LoadingIndicator />}
                    {/* Search */}
                    <div className="w-full sm:w-auto">
                        <div className="flex gap-1 mb-2">
                            {([
                                { key: 'name', label: 'Nome', icon: 'person' },
                                { key: 'phone', label: 'Telefone', icon: 'phone' },
                                { key: 'birthDate', label: 'Nascimento', icon: 'cake' },
                            ] as const).map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => { setSearchMode(opt.key); setSearchTerm(''); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                        searchMode === opt.key
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full sm:w-80">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                value={searchTerm}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    if (searchMode === 'name') {
                                        setSearchTerm(raw.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase()));
                                    } else if (searchMode === 'phone') {
                                        const digits = raw.replace(/\D/g, '');
                                        if (digits.length <= 10) {
                                            setSearchTerm(digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '').replace(/\(\) /, ''));
                                        } else {
                                            setSearchTerm(digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, ''));
                                        }
                                    } else {
                                        const digits = raw.replace(/\D/g, '');
                                        let formatted = digits;
                                        if (digits.length >= 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
                                        if (digits.length >= 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
                                        setSearchTerm(formatted);
                                    }
                                }}
                                className="w-full h-12 pl-12 pr-4 rounded-2xl border-none bg-white dark:bg-slate-900 shadow-sm focus:ring-2 focus:ring-primary text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400"
                                placeholder={
                                    searchMode === 'name' ? 'Digite o nome do paciente...' :
                                    searchMode === 'phone' ? '(00) 00000-0000' :
                                    'DD/MM/AAAA'
                                }
                                inputMode={searchMode === 'name' ? 'text' : 'numeric'}
                            />
                        </div>
                    </div>

                    {/* Hospital Filter (Full Access) */}
                    {isFullAccess ? (
                        <div className="relative w-full sm:w-64">
                            <select
                                value={selectedHospital}
                                onChange={(e) => setSelectedHospital(e.target.value)}
                                className="w-full h-12 pl-4 pr-10 appearance-none rounded-2xl border-none bg-white dark:bg-slate-900 shadow-sm text-sm font-bold focus:ring-primary text-slate-700 dark:text-white cursor-pointer"
                            >
                                <option>Todos os Hospitais</option>
                                {hospitals.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                        </div>
                    ) : (
                        <div className="h-12 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-bold border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-[18px]">domain</span>
                            {user?.hospitalName || 'Meu Hospital'}
                        </div>
                    )}

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`px-3 h-10 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">grid_view</span>
                            Cards
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('rows')}
                            className={`px-3 h-10 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'rows' ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">view_agenda</span>
                            Linhas
                        </button>
                    </div>

                    {/* Merge Button (Admin Only) */}
                    {isFullAccess && (
                        <button
                            type="button"
                            onClick={handleOpenMerge}
                            className="h-12 px-5 rounded-2xl bg-primary text-white font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[18px]">merge</span>
                            Mesclar
                        </button>
                    )}
                </div>
            </div>

            {/* Tags Filter */}
            <div className="flex flex-wrap items-center gap-2 pt-2 -mt-4">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">filter_list</span>
                    Filtrar por Tags:
                </span>
                {AVAILABLE_TAGS.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                        <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-300 border ${isSelected ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:text-primary'}`}
                        >
                            {tag}
                        </button>
                    );
                })}
                {selectedTags.length > 0 && (
                    <button
                        onClick={() => setSelectedTags([])}
                        className="px-2 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-300 text-slate-400 hover:text-red-500 flex items-center gap-1 ml-auto"
                    >
                        Limpar Filtros
                    </button>
                )}
            </div>

            {/* Patients View */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {isLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-64 rounded-[32px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))
                    ) : paginatedPatients.length > 0 ? (
                        paginatedPatients.map((patient, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleOpenHistory(patient)}
                                className="group bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-500 cursor-pointer relative overflow-hidden"
                            >
                                <div className="flex flex-col h-full relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex items-center justify-center font-black text-xl group-hover:from-primary group-hover:to-primary/80 group-hover:text-white transition-all duration-500 shadow-inner">
                                            {getInitials(patient.name)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-slate-900 dark:text-white text-lg truncate group-hover:text-primary transition-colors duration-300 tracking-tight">{patient.name}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="size-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativo</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                            <div className="size-8 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">call</span>
                                            </div>
                                            <span className="text-sm font-bold">{patient.phone || 'Sem telefone'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                            <div className="size-8 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">cake</span>
                                            </div>
                                            <span className="text-sm font-bold">{formatDate(patient.birthDate)}</span>
                                        </div>
                                    </div>

                                    {/* History Badges */}
                                    <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60">
                                        {patient.history && patient.history.length > 0 ? (
                                            patient.history.map((type, hIdx) => (
                                                <span
                                                    key={hIdx}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter uppercase border ${getHistoryBadgeClass(type)} transition-all hover:scale-110 active:scale-95`}
                                                >
                                                    {type}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-300 italic">Sem histórico</span>
                                        )}
                                    </div>
                                </div>

                                {/* Hover Arrow */}
                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                    <div className="size-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </div>
                                </div>

                                {/* Background Pattern */}
                                <div className="absolute -bottom-6 -right-6 size-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500"></div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700">
                            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">person_search</span>
                            <p className="text-slate-400 font-bold">Nenhum paciente encontrado.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {isLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))
                    ) : paginatedPatients.length > 0 ? (
                        paginatedPatients.map((patient, idx) => {
                            const historyPreview = patient.history?.slice(0, 3) || [];
                            const extraHistoryCount = (patient.history?.length || 0) - historyPreview.length;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleOpenHistory(patient)}
                                    className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-sm shrink-0">
                                                {getInitials(patient.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{patient.name}</h3>
                                                    <span className="hidden sm:inline text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativo</span>
                                                </div>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                                                    {patient.phone || 'Sem telefone'} • {formatDate(patient.birthDate)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:items-end gap-2 min-w-[160px]">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hospital</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{patient.hospital_name || 'Não informado'}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                                            {historyPreview.length > 0 ? (
                                                <>
                                                    {historyPreview.map((type, hIdx) => (
                                                        <span
                                                            key={hIdx}
                                                            className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter uppercase border ${getHistoryBadgeClass(type)}`}
                                                        >
                                                            {type}
                                                        </span>
                                                    ))}
                                                    {extraHistoryCount > 0 && (
                                                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter uppercase border bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-100 dark:border-slate-500/20">
                                                            +{extraHistoryCount}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-300 italic">Sem histórico</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700">
                            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">person_search</span>
                            <p className="text-slate-400 font-bold">Nenhum paciente encontrado.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest order-2 sm:order-1">
                        Mostrando <span className="text-slate-900 dark:text-white">{paginatedPatients.length}</span> de <span className="text-slate-900 dark:text-white">{filteredPatients.length}</span> pacientes
                    </p>
                    <div className="flex items-center gap-2 order-1 sm:order-2">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`size-10 rounded-xl flex items-center justify-center transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-primary shadow-sm active:scale-90'}`}
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                            {Array.from({ length: totalPages }).map((_, i) => {
                                const pageNum = i + 1;
                                // Show first, last, and pages around current
                                if (
                                    pageNum === 1 ||
                                    pageNum === totalPages ||
                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                ) {
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => goToPage(pageNum)}
                                            className={`size-10 rounded-xl text-xs font-black transition-all ${currentPage === pageNum ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-110' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                } else if (
                                    (pageNum === 2 && currentPage > 3) ||
                                    (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                ) {
                                    return <span key={pageNum} className="px-1 text-slate-300">...</span>;
                                }
                                return null;
                            })}
                        </div>

                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`size-10 rounded-xl flex items-center justify-center transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-primary shadow-sm active:scale-90'}`}
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Merge Modal */}
            {isMergeOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMergeOpen(false)} />
                    <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl">merge</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Mesclar Pacientes</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unifique registros duplicados de um mesmo paciente.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsMergeOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Info Banner */}
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
                                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5">info</span>
                                <div>
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Como funciona a mesclagem?</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                        Todos os agendamentos do paciente <strong>duplicado</strong> ser&atilde;o transferidos para o paciente <strong>principal</strong>.
                                        O registro duplicado ser&aacute; removido ap&oacute;s a mesclagem. Esta a&ccedil;&atilde;o n&atilde;o pode ser desfeita.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                                {/* Primary Patient */}
                                <div>
                                    <label className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 block flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">star</span>
                                        Paciente Principal (manter)
                                    </label>
                                    {mergePrimary ? (
                                        <div className="bg-green-50 dark:bg-green-900/10 border-2 border-green-300 dark:border-green-700 rounded-2xl p-4 relative">
                                            <button
                                                onClick={() => { setMergePrimary(null); setMergeSearchPrimary(''); }}
                                                className="absolute top-2 right-2 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="size-10 rounded-xl bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-400 flex items-center justify-center font-black text-sm">
                                                    {getInitials(mergePrimary.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{mergePrimary.name}</p>
                                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Principal</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">cake</span>
                                                    <span className="font-medium">{formatDate(mergePrimary.birthDate)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">call</span>
                                                    <span className="font-medium">{mergePrimary.phone || 'Sem telefone'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">domain</span>
                                                    <span className="font-medium">{mergePrimary.hospital_name || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                                <input
                                                    type="text"
                                                    value={mergeSearchPrimary}
                                                    onChange={(e) => setMergeSearchPrimary(e.target.value)}
                                                    placeholder="Buscar paciente principal..."
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                />
                                            </div>
                                            {mergeFilteredPrimary.length > 0 && (
                                                <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                                                    {mergeFilteredPrimary.map((p, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => { setMergePrimary(p); setMergeSearchPrimary(p.name); }}
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                                        >
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(p.birthDate)} • {p.hospital_name}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Swap Button */}
                                <div className="flex items-center justify-center md:pt-8">
                                    <button
                                        onClick={handleSwapMerge}
                                        disabled={!mergePrimary && !mergeDuplicate}
                                        className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-sm hover:shadow-md active:scale-90"
                                        title="Trocar pacientes"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                                    </button>
                                </div>

                                {/* Duplicate Patient */}
                                <div>
                                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                                        Paciente Duplicado (remover)
                                    </label>
                                    {mergeDuplicate ? (
                                        <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-300 dark:border-red-700 rounded-2xl p-4 relative">
                                            <button
                                                onClick={() => { setMergeDuplicate(null); setMergeSearchDuplicate(''); }}
                                                className="absolute top-2 right-2 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="size-10 rounded-xl bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-400 flex items-center justify-center font-black text-sm">
                                                    {getInitials(mergeDuplicate.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{mergeDuplicate.name}</p>
                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Duplicado</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">cake</span>
                                                    <span className="font-medium">{formatDate(mergeDuplicate.birthDate)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">call</span>
                                                    <span className="font-medium">{mergeDuplicate.phone || 'Sem telefone'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">domain</span>
                                                    <span className="font-medium">{mergeDuplicate.hospital_name || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                                <input
                                                    type="text"
                                                    value={mergeSearchDuplicate}
                                                    onChange={(e) => setMergeSearchDuplicate(e.target.value)}
                                                    placeholder="Buscar paciente duplicado..."
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                />
                                            </div>
                                            {mergeFilteredDuplicate.length > 0 && (
                                                <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                                                    {mergeFilteredDuplicate.map((p, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => { setMergeDuplicate(p); setMergeSearchDuplicate(p.name); }}
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                                        >
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(p.birthDate)} • {p.hospital_name}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Merge Preview */}
                            {mergePrimary && mergeDuplicate && (
                                <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-primary text-[18px]">preview</span>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Resultado da Mesclagem</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                                            {getInitials(mergePrimary.name)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{mergePrimary.name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {formatDate(mergePrimary.birthDate)} • Todos os agendamentos de "{mergeDuplicate.name}" ser&atilde;o transferidos.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsMergeOpen(false)}
                                className="px-5 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setShowMergeConfirm(true)}
                                disabled={!mergePrimary || !mergeDuplicate || isMerging}
                                className="px-5 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all text-sm shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isMerging ? (
                                    <>
                                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Mesclando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">merge</span>
                                        Mesclar Pacientes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Confirm Dialog */}
            <ConfirmModal
                isOpen={showMergeConfirm}
                onClose={() => setShowMergeConfirm(false)}
                onConfirm={handleConfirmMerge}
                title="Confirmar Mesclagem"
                message={`Todos os agendamentos de "${mergeDuplicate?.name || ''}" ser\u00e3o transferidos para "${mergePrimary?.name || ''}". O registro duplicado ser\u00e1 removido. Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.`}
                confirmText="Sim, Mesclar"
                cancelText="Cancelar"
                variant="warning"
            />

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
                                        {selectedPatient && getInitials(isEditingName ? nameInputValue : selectedPatient.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isEditingName ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={nameInputValue}
                                                    onChange={(e) => setNameInputValue(e.target.value)}
                                                    autoFocus
                                                    className="flex-1 h-10 px-3 rounded-xl border-2 border-primary text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none min-w-0"
                                                    placeholder="Nome completo"
                                                />
                                                <button onClick={handleSaveNameAndBirthDate} className="size-9 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                                </button>
                                                <button onClick={() => { setIsEditingName(false); setNameInputValue(selectedPatient?.name || ''); }} className="size-9 bg-red-100 text-red-500 rounded-xl hover:bg-red-200 transition-colors flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="group/name flex items-center gap-2">
                                                <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">{selectedPatient?.name}</h2>
                                                <button
                                                    onClick={() => setIsEditingName(true)}
                                                    className="opacity-0 group-hover/name:opacity-100 p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shrink-0"
                                                    title="Editar nome"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 mt-1">
                                            <Badge status="Ativo" />
                                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">id_card</span>
                                                Prontuário Digital
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors shrink-0"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                                                <button onClick={handleSavePhone} className="flex-1 h-8 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                                    Salvar
                                                </button>
                                                <button onClick={() => { setIsEditingPhone(false); setPhoneInputValue(selectedPatient?.phone || ''); }} className="flex-1 h-8 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                    Sair
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatient?.phone || 'Não informado'}</p>
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
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nascimento</p>
                                    {isEditingBirthDate ? (
                                        <div className="space-y-2">
                                            <input
                                                type="date"
                                                value={birthDateInputValue}
                                                onChange={(e) => setBirthDateInputValue(e.target.value)}
                                                autoFocus
                                                className="w-full h-9 px-2 rounded-lg border border-primary text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={handleSaveNameAndBirthDate} className="flex-1 h-8 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                                    Salvar
                                                </button>
                                                <button onClick={() => { setIsEditingBirthDate(false); setBirthDateInputValue(selectedPatient?.birthDate || ''); }} className="flex-1 h-8 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                    Sair
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatient && formatDate(selectedPatient.birthDate)}</p>
                                            <button
                                                onClick={() => setIsEditingBirthDate(true)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                                title="Editar data de nascimento"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 col-span-2 sm:col-span-1 relative group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hospital Principal</p>
                                    {isFullAccess && isEditingHospital ? (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <select
                                                    value={hospitalInputValue}
                                                    onChange={(e) => setHospitalInputValue(e.target.value)}
                                                    className="w-full h-9 px-2 rounded-lg border border-primary text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none appearance-none"
                                                >
                                                    <option value="" disabled>Selecione</option>
                                                    {hospitals.map(h => (
                                                        <option key={h.id} value={h.id}>{h.name}</option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleSaveHospital} className="flex-1 h-8 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                                    Salvar
                                                </button>
                                                <button onClick={() => { setIsEditingHospital(false); setHospitalInputValue(selectedPatient?.hospital_id || ''); }} className="flex-1 h-8 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase">
                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                    Sair
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{selectedPatient?.hospital_name}</p>
                                            {isFullAccess && (
                                                <button
                                                    onClick={() => setIsEditingHospital(true)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                                    title="Editar hospital"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
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
                                                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{item.payment_method || 'Forma não informada'}</p>
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
        </div>
    );
};

export default Patients;
