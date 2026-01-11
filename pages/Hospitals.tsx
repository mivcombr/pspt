import React, { useState, useEffect } from 'react';
import { hospitalService } from '../services/hospitalService';
import { profileService } from '../services/profileService';
import { procedureService } from '../services/procedureService';
import { doctorService } from '../services/doctorService';
import { userService } from '../services/userService';
import { hospitalDocumentService } from '../services/hospitalDocumentService';
import { paymentMethodService, HospitalPaymentMethod } from '../services/paymentMethodService';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { useNotification } from '../hooks/useNotification';
import { ConfirmModal } from '../components/ConfirmModal';

const Hospitals: React.FC = () => {
    const { user } = useAuth();
    const notify = useNotification();
    const [activeTab, setActiveTab] = useState<'Consulta' | 'Exame' | 'Cirurgia'>('Consulta');

    const [hospitals, setHospitals] = useState<any[]>([]);
    const [selectedHospital, setSelectedHospital] = useState<any>(null);
    const [hospitalUsers, setHospitalUsers] = useState<any[]>([]);
    const [hospitalDoctors, setHospitalDoctors] = useState<any[]>([]);
    const [hospitalDocuments, setHospitalDocuments] = useState<any[]>([]);
    const [hospitalPaymentMethods, setHospitalPaymentMethods] = useState<HospitalPaymentMethod[]>([]);
    const [procedures, setProcedures] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    // Hospital Modal State
    const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
    const [isEditingHospital, setIsEditingHospital] = useState(false);
    const [hospitalForm, setHospitalForm] = useState({ id: '', name: '', code: '', location: '', status: 'Ativo' });

    // Procedure Modal State
    const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
    const [isEditingProcedure, setIsEditingProcedure] = useState(false);
    const [procedureForm, setProcedureForm] = useState({ id: '', name: '', type: 'Consulta', standard_price: '', cash_price: '', repasse_value: '' });

    // Doctor Form State
    const [doctorForm, setDoctorForm] = useState({ name: '', specialty: '', crm: '' });

    // User Form State
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'RECEPTION' as 'RECEPTION' | 'FINANCIAL' });
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [isUserFormOpen, setIsUserFormOpen] = useState(false);
    const [isDoctorFormOpen, setIsDoctorFormOpen] = useState(false);

    // Payment Method State
    const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
    const [isEditingPaymentMethod, setIsEditingPaymentMethod] = useState(false);
    const [paymentMethodForm, setPaymentMethodForm] = useState<Partial<HospitalPaymentMethod>>({ id: '', name: '', is_automatic_repasse: false });

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

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hospData = await hospitalService.getAll();
            setHospitals(hospData);
            if (hospData.length > 0 && !selectedHospital) {
                setSelectedHospital(hospData[0]);
            }
        } catch (err) {
            console.error('Error fetching hospitals data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHospitalDetails = async (hospId: string) => {
        try {
            const [users, doctors, documents, paymentMethods, procs] = await Promise.all([
                profileService.getByHospital(hospId),
                doctorService.getByHospital(hospId),
                hospitalDocumentService.getByHospital(hospId),
                paymentMethodService.getAll(hospId),
                procedureService.getAll(hospId)
            ]);
            setHospitalUsers(users);
            setHospitalDoctors(doctors);
            setHospitalDocuments(documents);
            setHospitalPaymentMethods(paymentMethods);
            setProcedures(procs);
        } catch (err) {
            console.error('Error fetching hospital details:', err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedHospital) {
            fetchHospitalDetails(selectedHospital.id);
        }
    }, [selectedHospital]);

    const filteredHospitals = hospitals.filter(h =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredProcedures = procedures.filter(p => p.type === activeTab);

    const handleToggleStatus = async () => {
        if (!selectedHospital) return;
        const newStatus = selectedHospital.status === 'Ativo' ? 'Inativo' : 'Ativo';
        try {
            const updated = await hospitalService.update(selectedHospital.id, { status: newStatus });
            setSelectedHospital(updated);
            setHospitals(hospitals.map(h => h.id === updated.id ? updated : h));
        } catch (err) {
            console.error('Error toggling hospital status:', err);
        }
    };

    const handleDeleteHospital = async () => {
        if (!selectedHospital) return;
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Hospital',
            message: `Tem certeza que deseja excluir o hospital ${selectedHospital.name}? Esta ação não pode ser desfeita.`,
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await hospitalService.delete(selectedHospital.id);
                    const remaining = hospitals.filter(h => h.id !== selectedHospital.id);
                    setHospitals(remaining);
                    setSelectedHospital(remaining.length > 0 ? remaining[0] : null);
                    notify.success('Hospital excluído com sucesso!');
                } catch (err) {
                    console.error('Error deleting hospital:', err);
                    notify.error('Erro ao excluir hospital.');
                }
            },
        });
    };

    const handleDeleteProcedure = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Procedimento',
            message: 'Tem certeza que deseja excluir este procedimento?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await procedureService.delete(id);
                    setProcedures(procedures.filter(p => p.id !== id));
                    notify.success('Procedimento excluído com sucesso!');
                } catch (err) {
                    console.error('Error deleting procedure:', err);
                    notify.error('Erro ao excluir procedimento');
                }
            },
        });
    };

    const handleCreateDoctor = async () => {
        if (!selectedHospital || !doctorForm.name) return;
        setIsSaving(true);
        try {
            await doctorService.create({
                name: doctorForm.name,
                specialty: doctorForm.specialty,
                crm: doctorForm.crm,
                hospital_id: selectedHospital.id,
                active: true
            });
            notify.success('Médico criado com sucesso!');
            setDoctorForm({ name: '', specialty: '', crm: '' });
            setIsDoctorFormOpen(false);
            fetchHospitalDetails(selectedHospital.id);
        } catch (err) {
            console.error('Error creating doctor:', err);
            notify.error('Erro ao criar médico');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDoctor = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Médico',
            message: 'Tem certeza que deseja excluir este médico?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await doctorService.delete(id);
                    fetchHospitalDetails(selectedHospital.id);
                    notify.success('Médico excluído com sucesso!');
                } catch (err) {
                    console.error('Error deleting doctor:', err);
                    notify.error('Erro ao excluir médico');
                }
            },
        });
    };

    const handleSaveUser = async () => {
        if (!selectedHospital || !userForm.name || !userForm.email || (!isEditingUser && !userForm.password)) {
            notify.warning('Preencha todos os campos obrigatórios');
            return;
        }

        setIsSaving(true);
        const loadingToast = notify.loading(isEditingUser ? 'Atualizando usuário...' : 'Criando usuário...');

        try {
            if (isEditingUser && editingUserId) {
                await userService.updateUser(editingUserId, {
                    name: userForm.name,
                    role: userForm.role,
                    // Note: Edge function create-user only handles creation. 
                    // Profile update is direct via userService.updateUser
                });
                notify.success('Usuário atualizado com sucesso!');
            } else {
                await userService.createUser({
                    name: userForm.name,
                    email: userForm.email,
                    password: userForm.password,
                    role: userForm.role,
                    hospital_id: selectedHospital.id,
                });
                notify.success('Usuário criado com sucesso!');
            }

            notify.dismiss(loadingToast);
            setUserForm({ name: '', email: '', password: '', role: 'RECEPTION' });
            setIsEditingUser(false);
            setEditingUserId(null);
            setIsUserFormOpen(false);
            fetchHospitalDetails(selectedHospital.id);
        } catch (err: any) {
            console.error('Error saving user:', err);
            notify.dismiss(loadingToast);
            notify.error(err.message || 'Erro ao salvar usuário');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePaymentMethod = async () => {
        if (!selectedHospital || !paymentMethodForm.name) {
            notify.warning('Nome é obrigatório');
            return;
        }

        setIsSaving(true);
        try {
            if (isEditingPaymentMethod && paymentMethodForm.id) {
                await paymentMethodService.update(paymentMethodForm.id, {
                    name: paymentMethodForm.name,
                    is_automatic_repasse: paymentMethodForm.is_automatic_repasse
                });
                notify.success('Forma de pagamento atualizada!');
            } else {
                await paymentMethodService.create({
                    hospital_id: selectedHospital.id,
                    name: paymentMethodForm.name!,
                    is_automatic_repasse: paymentMethodForm.is_automatic_repasse || false
                });
                notify.success('Forma de pagamento criada!');
            }
            setIsPaymentMethodModalOpen(false);
            fetchHospitalDetails(selectedHospital.id);
        } catch (err: any) {
            console.error('Error saving payment method:', err);
            notify.error('Erro ao salvar forma de pagamento');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePaymentMethod = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Forma de Pagamento',
            message: 'Tem certeza que deseja excluir esta forma de pagamento?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await paymentMethodService.delete(id);
                    fetchHospitalDetails(selectedHospital.id);
                    notify.success('Excluído com sucesso!');
                } catch (err) {
                    notify.error('Erro ao excluir');
                }
            }
        });
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Usuário',
            message: `Tem certeza que deseja excluir o usuário ${userName}? Esta ação removerá o perfil do usuário do sistema.`,
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await userService.deleteUser(userId);
                    notify.success('Usuário excluído com sucesso!');
                    fetchHospitalDetails(selectedHospital.id);
                } catch (err: any) {
                    console.error('Error deleting user:', err);
                    notify.error(err.message || 'Erro ao excluir usuário');
                }
            },
        });
    };

    if (isLoading && hospitals.length === 0) {
        return (
            <div className="flex flex-col lg:flex-row gap-8 items-start animate-pulse">
                <aside className="hidden lg:flex w-80 flex-col rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    <div className="mt-6 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
                        ))}
                    </div>
                </aside>
                <div className="flex-1 space-y-6">
                    <div className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
                    <div className="h-72 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header List */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
                            placeholder="Pesquisar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setHospitalForm({ id: '', name: '', code: '', location: '', status: 'Ativo' });
                            setIsEditingHospital(false);
                            setIsHospitalModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-5 rounded-2xl hover:bg-green-700 transition-all text-sm shadow-md whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        Adicionar Hospital
                    </button>
                </div>

                <div className="mt-5 flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {filteredHospitals.map((h) => (
                        <button
                            key={h.id}
                            onClick={() => setSelectedHospital(h)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all shrink-0 ${selectedHospital?.id === h.id
                                ? 'bg-primary/5 text-primary border-primary'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                                } `}
                            type="button"
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${selectedHospital?.id === h.id
                                ? 'bg-white dark:bg-slate-800 text-primary border-slate-200 dark:border-slate-700'
                                : 'bg-white/80 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                } `}>
                                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-sm truncate max-w-[180px]">{h.name}</p>
                                <p className="text-xs opacity-70 truncate max-w-[180px]">{h.location}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="rounded-3xl min-w-0 w-full">
                {selectedHospital ? (
                    <div className="space-y-6">
                            {/* Hospital Header Card-Details Mode */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{selectedHospital.name}</h2>
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${selectedHospital.status === 'Ativo'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                } `}>
                                                {selectedHospital.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Detalhes e configurações do parceiro.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleDeleteHospital}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 text-sm font-bold transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span> Excluir
                                        </button>
                                        <button
                                            onClick={() => {
                                                setHospitalForm({
                                                    id: selectedHospital.id,
                                                    name: selectedHospital.name,
                                                    code: selectedHospital.code,
                                                    location: selectedHospital.location || '',
                                                    status: selectedHospital.status
                                                });
                                                setIsEditingHospital(true);
                                                setIsHospitalModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 text-sm font-bold transition-colors shadow-lg shadow-green-600/30"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">edit</span> Editar
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Informações Gerais</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Código</label>
                                            <p className="font-bold text-slate-900 dark:text-white text-lg">{selectedHospital.code}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Localização</label>
                                            <p className="font-bold text-slate-900 dark:text-white text-lg">{selectedHospital.location || 'Não informado'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hospital Users Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Usuários do Hospital</h3>
                                    <button
                                        onClick={() => setIsUserFormOpen((prev) => !prev)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">{isUserFormOpen ? 'close' : 'person_add'}</span>
                                        {isUserFormOpen ? 'Fechar' : 'Criar Usuário'}
                                    </button>
                                </div>

                                {hospitalUsers.length > 0 ? (
                                    hospitalUsers.map((u) => (
                                        <div key={u.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between mb-3 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${u.role === 'FINANCIAL'
                                                    ? 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30'
                                                    : 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30'
                                                    } `}>
                                                    <span className="material-symbols-outlined">{u.role === 'FINANCIAL' ? 'attach_money' : 'badge'}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${u.role === 'FINANCIAL'
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : 'bg-purple-50 text-purple-600 border-purple-100'
                                                            } `}>
                                                            {u.role}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium">{u.email || 'Email não disponível'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        setEditingUserId(u.id);
                                                        setIsEditingUser(true);
                                                        setIsUserFormOpen(true);
                                                        setUserForm({
                                                            name: u.name,
                                                            email: u.email || '',
                                                            password: '',
                                                            role: u.role as any
                                                        });
                                                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                                    className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-500 text-center py-4">Nenhum usuário vinculado a este hospital.</p>
                                )}

                                {/* Create User Form */}
                                {(isUserFormOpen || isEditingUser) && (
                                    <div className="mt-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-primary font-bold flex items-center gap-2 text-sm">
                                                <span className="material-symbols-outlined text-[20px]">{isEditingUser ? 'edit' : 'person_add'}</span>
                                                {isEditingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
                                            </h4>
                                            {isEditingUser && (
                                                <button
                                                    onClick={() => {
                                                        setIsEditingUser(false);
                                                        setEditingUserId(null);
                                                        setIsUserFormOpen(false);
                                                        setUserForm({ name: '', email: '', password: '', role: 'RECEPTION' });
                                                    }}
                                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 underline"
                                                >
                                                    Cancelar Edição
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">Nome Completo</label>
                                                    <input
                                                        type="text"
                                                        value={userForm.name}
                                                        onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                        placeholder="Ex: Maria Souza"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">E-mail</label>
                                                    <input
                                                        type="email"
                                                        value={userForm.email}
                                                        disabled={isEditingUser}
                                                        onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm disabled:opacity-50"
                                                        placeholder="exemplo@email.com"
                                                    />
                                                </div>
                                                {!isEditingUser && (
                                                    <div>
                                                        <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">Senha</label>
                                                        <input
                                                            type="password"
                                                            value={userForm.password}
                                                            onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                            placeholder="••••••••"
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">Nível de Acesso</label>
                                                    <div className="relative">
                                                        <select
                                                            value={userForm.role}
                                                            onChange={e => setUserForm({ ...userForm, role: e.target.value as 'RECEPTION' | 'FINANCIAL' })}
                                                            className="w-full h-11 pl-4 pr-10 appearance-none rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm text-slate-700 dark:text-white"
                                                        >
                                                            <option value="RECEPTION">Recepção</option>
                                                            <option value="FINANCIAL">Financeiro</option>
                                                        </select>
                                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    onClick={handleSaveUser}
                                                    disabled={isSaving}
                                                    className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isSaving ? 'Salvando...' : (isEditingUser ? 'Atualizar Usuário' : 'Salvar Usuário')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hospital Doctors Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700 mt-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Médicos do Hospital</h3>
                                    <button
                                        onClick={() => setIsDoctorFormOpen((prev) => !prev)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">{isDoctorFormOpen ? 'close' : 'person_add'}</span>
                                        {isDoctorFormOpen ? 'Fechar' : 'Cadastrar Médico'}
                                    </button>
                                </div>

                                {hospitalDoctors.length > 0 ? (
                                    hospitalDoctors.map((d) => (
                                        <div key={d.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between mb-3 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30">
                                                    <span className="material-symbols-outlined">stethoscope</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-900 dark:text-white">{d.name}</p>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border bg-blue-50 text-blue-600 border-blue-100">
                                                            {d.specialty || 'Clínico Geral'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium">CRM: {d.crm || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleDeleteDoctor(d.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs font-bold"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-500 text-center py-4">Nenhum médico vinculado a este hospital.</p>
                                )}

                                {/* Create Doctor Form */}
                                {isDoctorFormOpen && (
                                    <div className="mt-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-primary font-bold flex items-center gap-2 mb-4 text-sm">
                                            <span className="material-symbols-outlined text-[20px]">person_add</span> Cadastrar Novo Médico
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">Nome Completo</label>
                                                    <input
                                                        type="text"
                                                        value={doctorForm.name}
                                                        onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                        placeholder="Dr. Nome Exemplo"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">Especialidade</label>
                                                    <input
                                                        type="text"
                                                        value={doctorForm.specialty}
                                                        onChange={e => setDoctorForm({ ...doctorForm, specialty: e.target.value })}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                        placeholder="Ex: Cardiologia"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold mb-1.5 block ml-1">CRM</label>
                                                    <input
                                                        type="text"
                                                        value={doctorForm.crm}
                                                        onChange={e => setDoctorForm({ ...doctorForm, crm: e.target.value })}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                        placeholder="00000-UF"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    onClick={handleCreateDoctor}
                                                    disabled={isSaving}
                                                    className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-green-700 transition-colors shadow-md"
                                                >
                                                    {isSaving ? 'Salvando...' : 'Salvar Médico'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hospital Documents Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700 mt-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Documentos do Hospital</h3>
                                    <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold cursor-pointer hover:opacity-90 transition-all">
                                        <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                        {isUploading ? 'Enviando...' : 'Adicionar Documento'}
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || !selectedHospital) return;
                                                setIsUploading(true);
                                                try {
                                                    await hospitalDocumentService.upload(selectedHospital.id, file);
                                                    notify.success('Documento enviado com sucesso!');
                                                    fetchHospitalDetails(selectedHospital.id);
                                                } catch (err) {
                                                    console.error('Error uploading document:', err);
                                                    notify.error('Erro ao enviar documento');
                                                } finally {
                                                    setIsUploading(false);
                                                }
                                            }}
                                            disabled={isUploading}
                                        />
                                    </label>
                                </div>

                                {hospitalDocuments.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {hospitalDocuments.map((doc) => (
                                            <div key={doc.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between border border-slate-200 dark:border-slate-700 group hover:border-primary/30 transition-all">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-500">
                                                        <span className="material-symbols-outlined capitalize">
                                                            {doc.file_type?.includes('pdf') ? 'picture_as_pdf' :
                                                                doc.file_type?.includes('image') ? 'image' : 'description'}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate pr-2" title={doc.name}>{doc.name}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium">
                                                            {new Date(doc.created_at).toLocaleDateString()} • {(doc.file_size / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <a
                                                        href={hospitalDocumentService.getPublicUrl(doc.file_path)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                                                        title="Visualizar"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            setConfirmModal({
                                                                isOpen: true,
                                                                title: 'Excluir Documento',
                                                                message: `Tem certeza que deseja excluir o documento ${doc.name}?`,
                                                                variant: 'danger',
                                                                onConfirm: async () => {
                                                                    try {
                                                                        await hospitalDocumentService.delete(doc.id, doc.file_path);
                                                                        notify.success('Documento excluído!');
                                                                        fetchHospitalDetails(selectedHospital.id);
                                                                    } catch (err) {
                                                                        console.error('Error deleting document:', err);
                                                                        notify.error('Erro ao excluir documento');
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                        title="Excluir"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">folder_open</span>
                                        <p className="text-slate-500 text-sm font-medium">Nenhum documento anexado.</p>
                                    </div>
                                )}
                            </div>

                            {/* BLOCK 0: STATUS */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors ${selectedHospital.status === 'Ativo' ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-900/50' : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'} `}>
                                        <span className="material-symbols-outlined text-[24px]">power_settings_new</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Status da Operação</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                            {selectedHospital.status === 'Ativo' ? 'O hospital está ativo e recebendo agendamentos.' : 'O hospital está inativo e bloqueado para novos agendamentos.'}
                                        </p>
                                    </div>
                                </div>

                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={selectedHospital.status === 'Ativo'}
                                        onChange={handleToggleStatus}
                                    />
                                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                                    <span className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {selectedHospital.status === 'Ativo' ? 'Ativado' : 'Desativado'}
                                    </span>
                                </label>
                            </div>

                            {/* BLOCK 1: CONFIGURAÇÃO DE VALORES */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700">
                                <div className="mb-8 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
                                        <span className="material-symbols-outlined text-[24px]">payments</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Tabela de Preços do Hospital</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Os preços são definidos especificamente para este parceiro.</p>
                                    </div>
                                </div>

                                {/* Tabs Pill Style */}
                                <div className="flex gap-2 mb-6 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit border border-slate-200 dark:border-slate-700">
                                    {['Consulta', 'Exame', 'Cirurgia'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab as any)}
                                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'} `}
                                        >
                                            {tab}s
                                        </button>
                                    ))}
                                </div>

                                {/* List for Values */}
                                <div className="space-y-3">
                                    {filteredProcedures.length > 0 ? (
                                        filteredProcedures.map((p) => (
                                            <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                                <div className="mb-3 md:mb-0">
                                                    <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                                                    <p className="text-xs text-slate-500">{p.type}</p>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Preço parcelado</p>
                                                        <p className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(p.standard_price)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Preço à Vista</p>
                                                        <p className="font-black text-primary text-lg">{formatCurrency(p.cash_price)}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setProcedureForm({
                                                                    id: p.id,
                                                                    name: p.name,
                                                                    type: p.type,
                                                                    standard_price: p.standard_price.toString(),
                                                                    cash_price: p.cash_price.toString(),
                                                                    repasse_value: (p.repasse_value || 0).toString()
                                                                });
                                                                setIsEditingProcedure(true);
                                                                setIsProcedureModalOpen(true);
                                                            }}
                                                            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-primary"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProcedure(p.id)}
                                                            className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center py-8 text-slate-500">Nenhum procedimento encontrado nesta categoria.</p>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        setProcedureForm({ id: '', name: '', type: activeTab, standard_price: '', cash_price: '', repasse_value: '' });
                                        setIsEditingProcedure(false);
                                        setIsProcedureModalOpen(true);
                                    }}
                                    className="w-full mt-4 py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 font-bold text-sm hover:border-green-600 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">add</span> Adicionar Novo Procedimento
                                </button>
                            </div>

                            {/* BLOCK 2: FORMAS DE PAGAMENTO */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm card-shadow p-8 border border-slate-200 dark:border-slate-700">
                                <div className="mb-8 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                                            <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white">Formas de Pagamento</h2>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Configure as opções de pagamento aceitas por este parceiro.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setPaymentMethodForm({ name: '' });
                                            setIsEditingPaymentMethod(false);
                                            setIsPaymentMethodModalOpen(true);
                                        }}
                                        className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add</span> Adicionar
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {hospitalPaymentMethods.map((method) => (
                                        <div key={method.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-blue-500/50 transition-all">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">{method.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setPaymentMethodForm(method);
                                                        setIsEditingPaymentMethod(true);
                                                        setIsPaymentMethodModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePaymentMethod(method.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {hospitalPaymentMethods.length === 0 && (
                                        <div className="md:col-span-2 lg:col-span-3 py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                                            <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">payments</span>
                                            <p className="text-slate-400 font-bold text-sm">Nenhuma forma de pagamento configurada.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
                        <span className="material-symbols-outlined text-6xl mb-4">domain_disabled</span>
                        <p className="font-bold text-lg">Selecione um hospital para ver os detalhes</p>
                    </div>
                )}
            </div>

            {/* --- ADD HOSPITAL MODAL --- */}
            {isHospitalModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                {isEditingHospital ? 'Editar Hospital' : 'Novo Hospital'}
                            </h3>
                            <button onClick={() => setIsHospitalModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="space-y-4">
                            <input
                                placeholder="Nome do Hospital"
                                value={hospitalForm.name}
                                onChange={e => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                            />
                            <input
                                placeholder="Código (Ex: HOSP01)"
                                value={hospitalForm.code}
                                onChange={e => setHospitalForm({ ...hospitalForm, code: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                            />
                            <input
                                placeholder="Localização"
                                value={hospitalForm.location}
                                onChange={e => setHospitalForm({ ...hospitalForm, location: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                            />
                            <button
                                onClick={async () => {
                                    if (!hospitalForm.name) {
                                        notify.warning('Nome é obrigatório');
                                        return;
                                    }
                                    if (!hospitalForm.code) {
                                        notify.warning('Código é obrigatório');
                                        return;
                                    }
                                    setIsSaving(true);
                                    const loadingToast = notify.loading(isEditingHospital ? 'Atualizando hospital...' : 'Criando hospital...');
                                    try {
                                        if (isEditingHospital) {
                                            const updated = await hospitalService.update(hospitalForm.id, {
                                                name: hospitalForm.name,
                                                code: hospitalForm.code,
                                                location: hospitalForm.location,
                                                status: hospitalForm.status
                                            });
                                            if (selectedHospital?.id === updated.id) setSelectedHospital(updated);
                                        } else {
                                            await hospitalService.create({
                                                name: hospitalForm.name,
                                                code: hospitalForm.code,
                                                location: hospitalForm.location,
                                                status: hospitalForm.status
                                            });
                                        }
                                        await fetchData();
                                        notify.dismiss(loadingToast);
                                        notify.success(isEditingHospital ? 'Hospital atualizado com sucesso!' : 'Hospital criado com sucesso!');
                                        setIsHospitalModalOpen(false);
                                    } catch (e: any) {
                                        console.error(e);
                                        notify.dismiss(loadingToast);
                                        notify.error(`Erro ao ${isEditingHospital ? 'atualizar' : 'criar'} hospital: ${e.message || 'Erro desconhecido'} `);
                                    }
                                    finally { setIsSaving(false); }
                                }}
                                disabled={isSaving}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
                            >
                                {isSaving ? 'Salvando...' : (isEditingHospital ? 'Salvar Alterações' : 'Criar Hospital')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ADD PROCEDURE MODAL --- */}
            {isProcedureModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                {isEditingProcedure ? 'Editar Procedimento' : 'Novo Procedimento'}
                            </h3>
                            <button onClick={() => setIsProcedureModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="space-y-4">
                            <input
                                placeholder="Nome do Procedimento"
                                value={procedureForm.name}
                                onChange={e => setProcedureForm({ ...procedureForm, name: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                            />
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="isFree"
                                    checked={procedureForm.standard_price === '0' && procedureForm.standard_price !== '' && procedureForm.cash_price === '0' && procedureForm.repasse_value === '0'}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setProcedureForm({ ...procedureForm, standard_price: '0', cash_price: '0', repasse_value: '0' });
                                        } else {
                                            setProcedureForm({ ...procedureForm, standard_price: '', cash_price: '', repasse_value: '' });
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="isFree" className="text-sm font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                                    Procedimento sem custo (Gratuito)
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Preço parcelado</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={procedureForm.standard_price}
                                            onChange={e => setProcedureForm({ ...procedureForm, standard_price: e.target.value })}
                                            className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold disabled:opacity-50"
                                            disabled={procedureForm.standard_price === '0' && procedureForm.standard_price !== '' && procedureForm.cash_price === '0' && procedureForm.repasse_value === '0'}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Preço à Vista</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={procedureForm.cash_price}
                                            onChange={e => setProcedureForm({ ...procedureForm, cash_price: e.target.value })}
                                            className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold disabled:opacity-50"
                                            disabled={procedureForm.standard_price === '0' && procedureForm.standard_price !== '' && procedureForm.cash_price === '0' && procedureForm.repasse_value === '0'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Valor do Programa</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={procedureForm.repasse_value}
                                        onChange={e => setProcedureForm({ ...procedureForm, repasse_value: e.target.value })}
                                        className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold disabled:opacity-50"
                                        disabled={procedureForm.standard_price === '0' && procedureForm.standard_price !== '' && procedureForm.cash_price === '0' && procedureForm.repasse_value === '0'}
                                    />
                                </div>

                            </div>

                            <select
                                value={procedureForm.type}
                                onChange={e => setProcedureForm({ ...procedureForm, type: e.target.value as any })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                            >
                                <option value="Consulta">Consulta</option>
                                <option value="Exame">Exame</option>
                                <option value="Cirurgia">Cirurgia</option>
                            </select>

                            <button
                                onClick={async () => {
                                    if (!procedureForm.name) return notify.warning('Nome é obrigatório');
                                    setIsSaving(true);
                                    try {
                                        const payload = {
                                            name: procedureForm.name,
                                            type: procedureForm.type as any,
                                            standard_price: parseFloat(procedureForm.standard_price.toString().replace(',', '.')) || 0,
                                            cash_price: parseFloat(procedureForm.cash_price.toString().replace(',', '.')) || 0,
                                            repasse_value: parseFloat(procedureForm.repasse_value.toString().replace(',', '.')) || 0,
                                            hospital_id: selectedHospital.id
                                        };

                                        if (isEditingProcedure) {
                                            await procedureService.update(procedureForm.id, payload);
                                        } else {
                                            await procedureService.create(payload);
                                        }

                                        // Refetch
                                        const procData = await procedureService.getAll(selectedHospital.id);
                                        setProcedures(procData);
                                        setIsProcedureModalOpen(false);
                                        notify.success(isEditingProcedure ? 'Procedimento atualizado!' : 'Procedimento criado!');
                                    } catch (e: any) {
                                        console.error(e);
                                        notify.error(`Erro ao salvar procedimento: ${e.message || 'Erro desconhecido'}`);
                                    }
                                    finally { setIsSaving(false); }
                                }}
                                disabled={isSaving}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30"
                            >
                                {isSaving ? 'Salvando...' : (isEditingProcedure ? 'Salvar Alterações' : 'Criar Procedimento')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isPaymentMethodModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                {isEditingPaymentMethod ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
                            </h3>
                            <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nome da Forma de Pagamento</label>
                                <input
                                    placeholder="Ex: Pix, Cartão de Crédito..."
                                    value={paymentMethodForm.name}
                                    onChange={e => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                onClick={handleSavePaymentMethod}
                                disabled={isSaving}
                                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30 active:scale-[0.98] uppercase text-xs tracking-widest"
                            >
                                {isSaving ? 'Salvando...' : (isEditingPaymentMethod ? 'Atualizar Forma de Pagamento' : 'Criar Forma de Pagamento')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />
        </div>
    );
};

export default Hospitals;
