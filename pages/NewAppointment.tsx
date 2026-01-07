import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { useNotification } from '../hooks/useNotification';
import { ConfirmModal } from '../components/ConfirmModal';
import { appointmentService } from '../services/appointmentService';
import { hospitalService } from '../services/hospitalService';
import { procedureService } from '../services/procedureService';
import { doctorService } from '../services/doctorService';
import { scheduleBlockService, ScheduleBlock } from '../services/scheduleBlockService';
import { paymentMethodService, HospitalPaymentMethod } from '../services/paymentMethodService';

// Doctors list removed - dynamic fetching implemented

const NewAppointment: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useNotification();

  // State
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [hospitalDoctors, setHospitalDoctors] = useState<any[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [hospitalPaymentMethods, setHospitalPaymentMethods] = useState<HospitalPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  const [newPatientData, setNewPatientData] = useState({
    name: '',
    phone: '',
    birthDate: '',
    hospitalId: (user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? user.hospitalId : ''
  });

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    procedureType: 'Cirurgia',
    procedureName: '',
    hospitalId: (user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? user.hospitalId : '',
    doctor: '',
    date: formatDateForInput(new Date()),
    time: '14:30',
    value: '',
    paymentMethod: '',
    notes: ''
  });

  useEffect(() => {
    if (formData.hospitalId) {
      const fetchHospitalSpecificData = async () => {
        try {
          const [blocks, paymentMethods, procs] = await Promise.all([
            scheduleBlockService.getAll({ hospitalId: formData.hospitalId }),
            paymentMethodService.getAll(formData.hospitalId),
            procedureService.getAll(formData.hospitalId)
          ]);
          setScheduleBlocks(blocks);
          setHospitalPaymentMethods(paymentMethods);
          setProcedures(procs);
        } catch (err) {
          console.error('Error fetching hospital details:', err);
        }
      };
      fetchHospitalSpecificData();
    }
  }, [formData.hospitalId]);



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

      // Check for Draft
      const draft = localStorage.getItem('appointment_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setConfirmModal({
          isOpen: true,
          title: 'Rascunho Encontrado',
          message: 'Existe um rascunho salvo. Deseja restaurá-lo?',
          variant: 'info',
          onConfirm: () => {
            if (parsed.formData) setFormData(parsed.formData);
            if (parsed.selectedPatient) setSelectedPatient(parsed.selectedPatient);
          },
        });
      }
    } catch (err) {
      console.error('Error fetching data for new appointment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (formData.hospitalId) {
        try {
          const docs = await doctorService.getByHospital(formData.hospitalId);
          setHospitalDoctors(docs);
        } catch (err) {
          console.error('Error fetching doctors:', err);
        }
      } else {
        setHospitalDoctors([]);
      }
    };
    fetchDoctors();
  }, [formData.hospitalId]);

  const filteredProcedures = procedures.filter(p => p.type === formData.procedureType);

  // --- Handlers ---

  // Patient Search
  const handleSearchChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    setSearchTerm(term);
    setSelectedPatient(null);

    if (term.length >= 3) {
      try {
        const results = await appointmentService.getPatients(term);
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching patients:', err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const selectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setSearchTerm(patient.name.toLowerCase().replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()));
    setSearchResults([]);
  };

  // New Patient Logic
  const togglePatientMode = () => {
    setIsCreatingPatient(!isCreatingPatient);
    setSelectedPatient(null);
    setSearchTerm('');
    setSearchResults([]);
    setNewPatientData({
      name: '',
      phone: '',
      birthDate: '',
      hospitalId: (user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? user.hospitalId : ''
    });
  };

  const handleNewPatientInput = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;

    if (name === 'name') {
      value = value.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    }

    const updatedData = { ...newPatientData, [name]: value };
    setNewPatientData(updatedData);

    if (updatedData.name) {
      setSelectedPatient({
        id: 'new',
        ...updatedData
      });
    } else {
      setSelectedPatient(null);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'hospitalId') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        doctor: '',
        paymentMethod: ''
      }));
      return;
    }

    if (name === 'procedureName') {
      const selectedProc = procedures.find(p => p.name === value && p.type === formData.procedureType);
      if (selectedProc) {
        const initialValue = selectedProc.cash_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        setFormData(prev => ({
          ...prev,
          [name]: value,
          value: initialValue
        }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setProcedureType = (type: string) => {
    setFormData(prev => ({ ...prev, procedureType: type, procedureName: '' }));
  };

  const handleValueChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    value = (Number(value) / 100).toFixed(2) + '';
    value = value.replace('.', ',');
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    setFormData(prev => ({ ...prev, value: value }));
  };



  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      notify.warning('Por favor, selecione ou cadastre um paciente.');
      return;
    }
    if (!selectedPatient.name || !selectedPatient.phone) {
      notify.warning('Todos os dados do paciente (Nome e Telefone) são obrigatórios.');
      return;
    }

    if (!formData.procedureName || !formData.hospitalId) {
      notify.warning('Por favor, preencha os campos obrigatórios do agendamento (Procedimento e Hospital).');
      return;
    }

    // Check for schedule blocks
    const dayOfWeek = new Date(formData.date + 'T12:00:00').getDay();
    const isBlocked = scheduleBlocks.some(block => {
      // Check if day matches
      const dayMatches = (block.block_type === 'SPECIFIC_DAY' && block.date === formData.date) ||
        (block.block_type === 'WEEKLY_RECURRING' && block.day_of_week === dayOfWeek);
      if (!dayMatches) return false;

      // If no times specified, whole day is blocked
      if (!block.start_time || !block.end_time) return true;

      // Check if selected time is within blocked range
      const selectedTime = formData.time; // "HH:mm"
      return selectedTime >= block.start_time.substring(0, 5) && selectedTime <= block.end_time.substring(0, 5);
    });

    if (isBlocked) {
      notify.error('Este dia/horário está bloqueado na agenda do parceiro.');
      return;
    }

    try {
      const numericValue = parseFloat(formData.value.replace(/\./g, '').replace(',', '.'));

      // Get configured repasse value from selected procedure
      const selectedProc = procedures.find(p => p.name === formData.procedureName && p.type === formData.procedureType);
      const repasseVal = selectedProc?.repasse_value ? Number(selectedProc.repasse_value) : 0;
      const hospitalVal = numericValue - repasseVal;

      await appointmentService.create({
        hospital_id: formData.hospitalId,
        date: formData.date,
        time: formData.time + ':00',
        patient_name: selectedPatient.name.toLowerCase().replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()),
        patient_phone: selectedPatient.phone,
        patient_birth_date: selectedPatient.birthDate || null,
        type: formData.procedureType.toUpperCase(),
        procedure: formData.procedureName,
        provider: formData.doctor,
        total_cost: isNaN(numericValue) ? 0 : numericValue,
        repasse_value: repasseVal,
        hospital_value: hospitalVal,
        notes: formData.notes,
        payment_method: formData.paymentMethod,
        status: 'Agendado',
        payment_status: 'Pendente',
        repasse_status: 'Pendente',
        repasse_paid_at: null as any
      });

      notify.success(`Agendamento realizado com sucesso para ${selectedPatient.name}!`);
      localStorage.removeItem('appointment_draft'); // Clear draft on success
      navigate('/attendances');
    } catch (err) {
      console.error('Error creating appointment:', err);
      notify.error('Erro ao realizar agendamento.');
    }
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    setIsCreatingPatient(false);
    setNewPatientData({
      name: '',
      phone: '',
      birthDate: '',
      hospitalId: (user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? user.hospitalId : ''
    });
    setFormData({
      procedureType: 'Cirurgia',
      procedureName: '',
      hospitalId: (user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? user.hospitalId : '',
      doctor: '',
      date: new Date().toISOString().split('T')[0],
      time: '14:30',
      value: '',
      paymentMethod: '',
      notes: ''
    });

  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-[-0.033em] text-slate-900 dark:text-white">Novo Agendamento</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Informações do Paciente</h2>
              <button
                onClick={togglePatientMode}
                className="text-sm font-bold text-primary hover:text-blue-700 hover:underline transition-colors"
              >
                {isCreatingPatient ? 'Buscar Existente' : 'Cadastrar Novo'}
              </button>
            </div>

            {!isCreatingPatient ? (
              <label className="flex flex-col relative">
                <div className="flex justify-between">
                  <p className="text-sm font-medium leading-normal pb-2 text-slate-600 dark:text-slate-300">Buscar Paciente</p>
                </div>
                <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                  <input
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base"
                    placeholder={(user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? `Buscar paciente...` : "Digite o nome do paciente..."}
                  />
                  <div className="absolute inset-y-0 right-0 text-slate-400 flex items-center justify-center pr-4">
                    <span className="material-symbols-outlined text-xl">search</span>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {searchResults.map(patient => (
                      <div
                        key={patient.id}
                        onClick={() => selectPatient(patient)}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {patient.name.toLowerCase().replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase())}
                        </p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-slate-500">Nasc: {formatDateDisplay(patient.birthDate)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </label>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg text-sm text-primary mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <span>Todos os campos abaixo são obrigatórios.</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex flex-col md:col-span-2">
                    <p className="text-sm font-medium leading-normal pb-2 text-slate-600 dark:text-slate-300">Nome Completo <span className="text-red-500">*</span></p>
                    <input
                      name="name"
                      value={newPatientData.name}
                      onChange={handleNewPatientInput}
                      className="form-input w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                      placeholder="Ex: João da Silva"
                      required
                    />
                  </label>
                  <label className="flex flex-col">
                    <p className="text-sm font-medium leading-normal pb-2 text-slate-600 dark:text-slate-300">Telefone <span className="text-red-500">*</span></p>
                    <input
                      name="phone"
                      value={newPatientData.phone}
                      onChange={handleNewPatientInput}
                      className="form-input w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </label>
                  <label className="flex flex-col">
                    <p className="text-sm font-medium leading-normal pb-2 text-slate-600 dark:text-slate-300">Data de Nascimento</p>
                    <input
                      name="birthDate"
                      type="date"
                      value={newPatientData.birthDate}
                      onChange={handleNewPatientInput}
                      className="form-input w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col md:col-span-2">
                    <p className="text-sm font-medium leading-normal pb-2 text-slate-600 dark:text-slate-300">
                      Parceiro Vinculado <span className="text-red-500">*</span>
                    </p>
                    {(user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL) ? (
                      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 transition-all hover:bg-primary/[0.08]">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[22px]">local_hospital</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary/60">Unidade Vinculada</span>
                          <span className="font-bold text-slate-900 dark:text-white leading-tight">{user.hospitalName}</span>
                        </div>
                        <div className="ml-auto flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-800">
                          <span className="material-symbols-outlined text-[16px] text-slate-400">verified</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          name="hospitalId"
                          value={newPatientData.hospitalId}
                          onChange={handleNewPatientInput}
                          className="form-select w-full appearance-none rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                        >
                          <option value="" disabled>Selecione o Parceiro</option>
                          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">keyboard_arrow_down</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {selectedPatient && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-700 dark:text-slate-200 border border-blue-100 dark:border-blue-900/50 animate-in fade-in duration-300">
                <div><span className="font-bold text-slate-900 dark:text-white block text-xs uppercase tracking-wider mb-1 text-slate-500">Nome</span> {selectedPatient.name}</div>
                <div><span className="font-bold text-slate-900 dark:text-white block text-xs uppercase tracking-wider mb-1 text-slate-500">Nascimento</span> {formatDateDisplay(selectedPatient.birthDate)}</div>
                <div><span className="font-bold text-slate-900 dark:text-white block text-xs uppercase tracking-wider mb-1 text-slate-500">Telefone</span> {selectedPatient.phone || '-'}</div>
              </div>
            )}

            {!selectedPatient && !isCreatingPatient && (
              <div className="mt-4 p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center">
                <p className="text-sm text-slate-400">Nenhum paciente selecionado</p>
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">2. Detalhes do Agendamento</h2>
            <div className="space-y-6">

              {/* 1. LOCAL DE ATENDIMENTO (FIRST) */}
              <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:border-primary/30">
                {user?.role === UserRole.ADMIN ? (
                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-primary uppercase tracking-widest ml-1">Unidade de Atendimento</p>
                    <div className="relative">
                      <select
                        name="hospitalId"
                        value={formData.hospitalId}
                        onChange={handleInputChange}
                        className="form-select w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all shadow-sm"
                      >
                        <option value="" disabled>Selecione onde será o atendimento</option>
                        {hospitals.map((h, i) => <option key={i} value={h.id}>{h.name}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">location_on</span>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">location_on</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Unidade de Atendimento</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{user?.hospitalName}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* REST OF THE FIELDS - DEPENDENT ON LOCAL */}
              <div className={`space-y-6 transition-all duration-500 ${!formData.hospitalId ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Procedimento</p>
                    <div className="flex h-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                      {['Consulta', 'Exame', 'Cirurgia'].map(type => (
                        <label key={type} className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-black uppercase tracking-widest transition-all ${formData.procedureType === type ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                          <span>{type}</span>
                          <input
                            type="radio"
                            name="procedureType"
                            value={type}
                            checked={formData.procedureType === type}
                            onChange={() => setProcedureType(type)}
                            className="hidden"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Procedimento Específico</p>
                    <div className="relative">
                      <select
                        name="procedureName"
                        value={formData.procedureName}
                        onChange={handleInputChange}
                        className="form-select w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                      >
                        <option value="" disabled>Escolha uma opção</option>
                        {filteredProcedures.map((proc, i) => <option key={i} value={proc.name}>{proc.name}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">keyboard_arrow_down</span>
                    </div>
                  </label>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4`}>
                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Profissional de Saúde</p>
                    <div className="relative">
                      <select
                        name="doctor"
                        value={formData.doctor}
                        onChange={handleInputChange}
                        disabled={!formData.hospitalId}
                        className="form-select w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white disabled:opacity-50"
                      >
                        <option value="" disabled>
                          {!formData.hospitalId
                            ? 'Selecione um hospital primeiro'
                            : hospitalDoctors.length === 0
                              ? 'Nenhum médico encontrado'
                              : 'Selecione o médico'}
                        </option>
                        {hospitalDoctors.map((d, i) => (
                          <option key={i} value={d.name}>
                            {d.name} {d.specialty ? `(${d.specialty})` : ''}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">keyboard_arrow_down</span>
                    </div>
                  </label>
                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data do Agendamento</p>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="form-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="flex flex-col text-slate-600 dark:text-slate-300">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Horário</p>
                    <input
                      type="time"
                      name="time"
                      value={formData.time}
                      onChange={handleInputChange}
                      className="form-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Valor a ser Pago (R$)</p>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 text-xs font-bold">R$</span>
                      </div>
                      <input
                        type="text"
                        name="value"
                        value={formData.value}
                        onChange={handleValueChange}
                        className="form-input w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 pl-10 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                        placeholder="0,00"
                      />
                    </div>
                  </label>
                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Forma de Pagamento</p>
                    <div className="relative">
                      <select
                        name="paymentMethod"
                        value={formData.paymentMethod}
                        onChange={handleInputChange}
                        className="form-select w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white"
                        disabled={!formData.hospitalId}
                      >
                        <option value="" disabled>
                          {!formData.hospitalId ? 'Selecione um hospital primeiro' : 'Selecione'}
                        </option>
                        {hospitalPaymentMethods.map((m) => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">keyboard_arrow_down</span>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <label className="flex flex-col">
                    <p className="text-[10px] font-black leading-normal pb-2 text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Observações e Anexos</p>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      className="form-textarea w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white resize-none"
                      rows={4}
                      placeholder="Adicionar notas clínicas ou observações importantes..."
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Resumo do Agendamento</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Paciente</span>
                <span className="font-bold text-right text-slate-900 dark:text-white max-w-[150px] truncate">
                  {selectedPatient ? selectedPatient.name : <span className="text-slate-300 italic">Não selecionado</span>}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Tipo</span>
                <span className="font-medium text-right text-slate-900 dark:text-white">{formData.procedureType}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Procedimento</span>
                <span className="font-medium text-right text-slate-900 dark:text-white max-w-[150px] truncate">
                  {formData.procedureName || <span className="text-slate-300 italic">-</span>}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Local</span>
                <span className="font-medium text-right text-slate-900 dark:text-white max-w-[150px] truncate">
                  {hospitals.find(h => h.id === formData.hospitalId)?.name || <span className="text-slate-300 italic">-</span>}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Médico</span>
                <span className="font-medium text-right text-slate-900 dark:text-white max-w-[150px] truncate">
                  {formData.doctor || <span className="text-slate-300 italic">-</span>}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Data e Hora</span>
                <span className="font-medium text-right text-slate-900 dark:text-white">
                  {formatDateDisplay(formData.date)} às {formData.time}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 dark:text-slate-400">Valor Estimado</span>
                <span className="font-black text-right text-primary text-lg">
                  {formData.value ? `R$ ${formData.value}` : 'R$ 0,00'}
                </span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <button
                onClick={handleSubmit}
                className="w-full flex items-center justify-center rounded-lg h-11 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm transition-colors"
              >
                Agendar Procedimento
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('appointment_draft', JSON.stringify({ formData, selectedPatient }));
                  notify.success('Rascunho salvo localmente! Ele será recuperado ao recarregar a página.');
                }}
                className="w-full flex items-center justify-center rounded-lg h-11 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold transition-colors"
              >
                Salvar como Rascunho
              </button>
              <button
                onClick={resetForm}
                className="w-full flex items-center justify-center rounded-lg h-11 px-4 text-danger hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-medium transition-colors"
              >
                Cancelar / Limpar
              </button>
            </div>
          </div>
        </aside>
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant}
        />
      </div>
    </div>
  );
};

export default NewAppointment;