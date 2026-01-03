import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useNotification } from '../hooks/useNotification';

interface PatientRecord {
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
    const [selectedHospital, setSelectedHospital] = useState('Todos os Hospitais');
    const [hospitals, setHospitals] = useState<any[]>([]);

    // History Modal State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    const isAdmin = user?.role === UserRole.ADMIN;

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hospitalArr = await hospitalService.getAll();
            setHospitals(hospitalArr);

            const effectiveHospitalId = (!isAdmin) ? user?.hospitalId : (selectedHospital !== 'Todos os Hospitais' ? hospitalArr.find(h => h.name === selectedHospital)?.id : undefined);

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
        fetchData();
    }, [selectedHospital, searchTerm]);

    const handleOpenHistory = async (patient: PatientRecord) => {
        setSelectedPatient(patient);
        setIsHistoryOpen(true);
        setIsFetchingHistory(true);
        try {
            const data = await appointmentService.getPatientHistory(patient.name, patient.birthDate);
            setHistory(data);
        } catch (err) {
            console.error('Error fetching history:', err);
            notify.error('Erro ao carregar histórico.');
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-8 relative animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pacientes</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Histórico e registros únicos de pacientes.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-80">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 rounded-2xl border-none bg-white dark:bg-slate-900 shadow-sm focus:ring-2 focus:ring-primary text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400"
                            placeholder="Buscar paciente por nome..."
                        />
                    </div>

                    {/* Hospital Filter (Admin Only) */}
                    {isAdmin ? (
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
                </div>
            </div>

            {/* Patients Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 rounded-[32px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))
                ) : patients.length > 0 ? (
                    patients.map((patient, idx) => (
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
                                        patient.history.map((type, hIdx) => {
                                            const colors: Record<string, string> = {
                                                'CONSULTA': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20',
                                                'CIRURGIA': 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
                                                'EXAMES': 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20',
                                                'RETORNO': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                            };

                                            // Determine base type for coloring
                                            let baseType = type;
                                            if (type.includes('RETORNO')) baseType = 'RETORNO';
                                            else if (type.includes('CONSULTA')) baseType = 'CONSULTA';
                                            else if (type.includes('CIRURGIA')) baseType = 'CIRURGIA';
                                            else if (type.includes('EXAME')) baseType = 'EXAMES'; // Handles both EXAME and EXAMES

                                            const colorClass = colors[baseType] || 'bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-100 dark:border-slate-500/20';

                                            return (
                                                <span
                                                    key={hIdx}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter uppercase border ${colorClass} transition-all hover:scale-110 active:scale-95`}
                                                >
                                                    {type}
                                                </span>
                                            );
                                        })
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
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 col-span-2 sm:col-span-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hospital Principal</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{selectedPatient?.hospital_name}</p>
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
        </div>
    );
};

export default Patients;
