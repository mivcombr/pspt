import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { Appointment } from '../types';
import { APP_TIME_ZONE } from '../utils/formatters';

export const appointmentService = {
    async getAll(filters?: { date?: string; hospitalId?: string; startDate?: string; endDate?: string }) {
        let query = supabase
            .from('appointments')
            .select(`
                *,
                hospital:hospitals(name),
                payments:appointment_payments(*)
            `);

        if (filters?.date) {
            query = query.eq('date', filters.date);
        }

        if (filters?.startDate) {
            query = query.gte('date', filters.startDate);
        }

        if (filters?.endDate) {
            query = query.lte('date', filters.endDate);
        }

        if (filters?.hospitalId) {
            query = query.eq('hospital_id', filters.hospitalId);
        }

        const { data, error } = await query.order('time', { ascending: true });

        if (error) {
            logger.error({ action: 'read', entity: 'appointments', error }, 'crud');
            throw error;
        }
        return data;
    },

    async create(appointment: any) {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...appointment,
            user_id: user?.id
        };

        const { data, error } = await supabase
            .from('appointments')
            .insert([payload])
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'appointments', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'appointments', id: data?.id }, 'crud');
        return data;
    },

    async update(id: string, updates: any) {
        // Fetch previous state for audit log
        let previousState: any = {};
        try {
            const { data: current } = await supabase
                .from('appointments')
                .select('*')
                .eq('id', id)
                .single();
            if (current) {
                previousState = current;
            }
        } catch (e) {
            console.warn('Could not fetch previous state for audit:', e);
        }

        const { data, error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'appointments', id, error }, 'crud');
            throw error;
        }

        // Log Changes (Audit)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const changes: any = {};

            Object.keys(updates).forEach(key => {
                const oldValue = previousState[key];
                const newValue = updates[key];

                // Simple equality check
                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    changes[key] = {
                        from: oldValue ?? null,
                        to: newValue
                    };
                }
            });

            if (Object.keys(changes).length > 0) {
                await supabase.from('appointment_audit_logs').insert([{
                    appointment_id: id,
                    changed_by: user?.id,
                    changed_at: new Date(),
                    changes: changes,
                    previous_state: previousState
                }]);
            }
        } catch (auditErr) {
            console.error('Failed to log audit:', auditErr);
        }

        logger.info({ action: 'update', entity: 'appointments', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    async getAuditLogs(appointmentId: string) {
        try {
            // Try to fetch with user relation first
            const { data, error } = await supabase
                .from('appointment_audit_logs')
                .select(`
                    *,
                    user:profiles!changed_by(name, email)
                `)
                .eq('appointment_id', appointmentId)
                .order('changed_at', { ascending: false });

            if (error) {
                // If error with relation, try without it
                console.warn('Error fetching audit logs with user relation:', error);
                logger.error({ action: 'read', entity: 'appointment_audit_logs', appointment_id: appointmentId, error }, 'crud');
                const { data: dataWithoutUser, error: errorWithoutUser } = await supabase
                    .from('appointment_audit_logs')
                    .select('*')
                    .eq('appointment_id', appointmentId)
                    .order('changed_at', { ascending: false });

                if (errorWithoutUser) {
                    console.error('Error fetching audit logs:', errorWithoutUser);
                    logger.error({ action: 'read', entity: 'appointment_audit_logs', appointment_id: appointmentId, error: errorWithoutUser }, 'crud');
                    return [];
                }
                return dataWithoutUser || [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error in getAuditLogs:', err);
            logger.error({ action: 'read', entity: 'appointment_audit_logs', appointment_id: appointmentId, error: err }, 'crud');
            return [];
        }
    },

    async addPayment(payment: any) {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...payment,
            user_id: user?.id
        };

        const { data, error } = await supabase
            .from('appointment_payments')
            .insert([payload])
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'appointment_payments', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'appointment_payments', id: data?.id }, 'crud');
        return data;
    },

    async deletePayment(id: string) {
        const { error } = await supabase
            .from('appointment_payments')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'appointment_payments', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'appointment_payments', id }, 'crud');
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'appointments', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'appointments', id }, 'crud');
    },

    async getDashboardData(filters: { startDate: string; endDate: string; hospitalId?: string }) {
        const start = new Date(filters.startDate + 'T00:00:00');
        const end = new Date(filters.endDate + 'T23:59:59');
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - diffMs);
        const prevStartDateStr = prevStart.toISOString().split('T')[0];
        const prevEndDateStr = prevEnd.toISOString().split('T')[0];

        let query = supabase
            .from('appointments')
            .select(`
                total_cost, 
                repasse_value, 
                hospital_value,
                type, 
                status, 
                date,
                hospital_id,
                hospital:hospitals(name, code, location)
            `)
            .gte('date', filters.startDate)
            .lte('date', filters.endDate);

        let prevQuery = supabase
            .from('appointments')
            .select(`total_cost, repasse_value, hospital_value, type, status, date, hospital_id`)
            .gte('date', prevStartDateStr)
            .lte('date', prevEndDateStr);

        let expensesQuery = supabase
            .from('expenses')
            .select('id, due_date, value, hospital_id')
            .gte('due_date', filters.startDate)
            .lte('due_date', filters.endDate);

        let prevExpensesQuery = supabase
            .from('expenses')
            .select('id, due_date, value, hospital_id')
            .gte('due_date', prevStartDateStr)
            .lte('due_date', prevEndDateStr);

        if (filters.hospitalId && filters.hospitalId !== 'Todos os Parceiros' && filters.hospitalId !== 'Todos os Hospitais') {
            query = query.eq('hospital_id', filters.hospitalId);
            prevQuery = prevQuery.eq('hospital_id', filters.hospitalId);
            expensesQuery = expensesQuery.eq('hospital_id', filters.hospitalId);
            prevExpensesQuery = prevExpensesQuery.eq('hospital_id', filters.hospitalId);
        }

        const [currRes, prevRes, expRes, prevExpRes] = await Promise.all([
            query, prevQuery, expensesQuery, prevExpensesQuery
        ]);

        if (currRes.error) {
            logger.error({ action: 'read', entity: 'appointments', error: currRes.error }, 'crud');
            throw currRes.error;
        }

        const data = currRes.data || [];
        const prevData = prevRes.data || [];
        let expensesData = expRes.data || [];
        let expensesError = expRes.error;
        let prevExpensesData = prevExpRes.data || [];
        let prevExpensesError = prevExpRes.error;

        if ((expensesError && expensesError.message?.includes('column "hospital_id" does not exist')) ||
            (prevExpensesError && prevExpensesError.message?.includes('column "hospital_id" does not exist'))) {
            let fallbackQuery = supabase
                .from('expenses')
                .select('id, due_date, value')
                .gte('due_date', filters.startDate)
                .lte('due_date', filters.endDate);

            let fallbackPrevQuery = supabase
                .from('expenses')
                .select('id, due_date, value')
                .gte('due_date', prevStartDateStr)
                .lte('due_date', prevEndDateStr);

            const [fallRes, fallPrevRes] = await Promise.all([fallbackQuery, fallbackPrevQuery]);
            expensesData = (fallRes.data || []) as any[];
            expensesError = fallRes.error;
            prevExpensesData = (fallPrevRes.data || []) as any[];
        }

        if (expensesError) {
            logger.error({ action: 'read', entity: 'expenses', error: expensesError }, 'crud');
        }

        let chartData: any[] = [];
        if (diffDays <= 31) {
            // Granularidade diária (mesmo intervalo do filtro)
            for (let i = 0; i < diffDays; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: APP_TIME_ZONE });
                chartData.push({
                    name: dayLabel,
                    dateKey: dateStr,
                    revenue: 0,
                    repasse: 0,
                    hospital: 0,
                    expenses: 0,
                    consultas: 0,
                    exames: 0,
                    cirurgias: 0
                });
            }

            data.forEach(curr => {
                const match = chartData.find(c => c.dateKey === curr.date);
                if (match) {
                    const revenue = Number(curr.total_cost);
                    const repasse = Number(curr.repasse_value);
                    const hospitalValue = Number(curr.hospital_value);
                    match.revenue += revenue;
                    match.repasse += repasse;
                    match.hospital += Number.isFinite(hospitalValue) ? hospitalValue : 0;
                    if (curr.type === 'CONSULTA') match.consultas++;
                    if (curr.type === 'EXAME') match.exames++;
                    if (curr.type === 'CIRURGIA') match.cirurgias++;
                }
            });

            expensesData.forEach(curr => {
                const match = chartData.find(c => c.dateKey === curr.due_date);
                if (match) {
                    const expenseValue = Number(curr.value);
                    match.expenses += Number.isFinite(expenseValue) ? expenseValue : 0;
                }
            });
        } else {
            // Granularidade mensal (padrão 12 meses do ano selecionado)
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            chartData = months.map(month => ({
                name: month,
                revenue: 0,
                repasse: 0,
                hospital: 0,
                expenses: 0,
                consultas: 0,
                exames: 0,
                cirurgias: 0
            }));

            data.forEach(curr => {
                if (!curr.date) return;
                const pieces = curr.date.split('-');
                const monthIdx = Number(pieces[1]) - 1;
                if (monthIdx < 0 || monthIdx > 11) return;

                const revenue = Number(curr.total_cost);
                const repasse = Number(curr.repasse_value);
                const hospitalValue = Number(curr.hospital_value);
                chartData[monthIdx].revenue += revenue;
                chartData[monthIdx].repasse += repasse;
                chartData[monthIdx].hospital += Number.isFinite(hospitalValue) ? hospitalValue : 0;
                if (curr.type === 'CONSULTA') chartData[monthIdx].consultas++;
                if (curr.type === 'EXAME') chartData[monthIdx].exames++;
                if (curr.type === 'CIRURGIA') chartData[monthIdx].cirurgias++;
            });

            expensesData.forEach(curr => {
                if (!curr.due_date) return;
                const pieces = curr.due_date.split('-');
                const monthIdx = Number(pieces[1]) - 1;
                if (monthIdx < 0 || monthIdx > 11) return;
                const expenseValue = Number(curr.value);
                chartData[monthIdx].expenses += Number.isFinite(expenseValue) ? expenseValue : 0;
            });
        }

        const totals = {
            revenue: 0,
            repasse: 0,
            hospital: 0,
            expenses: 0,
            consultas: 0,
            exames: 0,
            cirurgias: 0,
            consultas_revenue: 0,
            exames_revenue: 0,
            cirurgias_revenue: 0
        };
        const prevTotals = { ...totals };
        const partnerMap: Record<string, any> = {};

        data.forEach(curr => {
            const revenue = Number(curr.total_cost);
            const repasse = Number(curr.repasse_value);

            const hospitalValue = Number(curr.hospital_value);

            totals.revenue += revenue;
            totals.repasse += repasse;
            totals.hospital += Number.isFinite(hospitalValue) ? hospitalValue : 0;
            if (curr.type === 'CONSULTA') {
                totals.consultas++;
                totals.consultas_revenue += revenue;
            }
            if (curr.type === 'EXAME') {
                totals.exames++;
                totals.exames_revenue += revenue;
            }
            if (curr.type === 'CIRURGIA') {
                totals.cirurgias++;
                totals.cirurgias_revenue += revenue;
            }

            if (curr.hospital) {
                const h = curr.hospital as any;
                if (!partnerMap[h.name]) {
                    partnerMap[h.name] = {
                        name: h.name,
                        code: h.code,
                        location: h.location,
                        totalRevenue: 0,
                        totalRepasse: 0
                    };
                }
                partnerMap[h.name].totalRevenue += revenue;
                partnerMap[h.name].totalRepasse += repasse;
            }
        });

        expensesData.forEach(curr => {
            const expenseValue = Number(curr.value);
            totals.expenses += Number.isFinite(expenseValue) ? expenseValue : 0;
        });

        prevData.forEach(curr => {
            const revenue = Number(curr.total_cost) || 0;
            const repasse = Number(curr.repasse_value) || 0;
            const hospitalValue = Number(curr.hospital_value) || 0;

            prevTotals.revenue += revenue;
            prevTotals.repasse += repasse;
            prevTotals.hospital += hospitalValue;

            if (curr.type === 'CONSULTA') {
                prevTotals.consultas++;
                prevTotals.consultas_revenue += revenue;
            } else if (curr.type === 'EXAME') {
                prevTotals.exames++;
                prevTotals.exames_revenue += revenue;
            } else if (curr.type === 'CIRURGIA') {
                prevTotals.cirurgias++;
                prevTotals.cirurgias_revenue += revenue;
            }
        });

        prevExpensesData.forEach(curr => {
            prevTotals.expenses += Number(curr.value) || 0;
        });

        const partnerBreakdown = Object.values(partnerMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { chartData, totals, prevTotals, partnerBreakdown };
    },

    async getProviders() {
        const { data, error } = await supabase
            .from('appointments')
            .select('provider');

        if (error) {
            logger.error({ action: 'read', entity: 'appointments', error }, 'crud');
            throw error;
        }

        // Return unique names
        const names = data.map(d => d.provider).filter(p => p && p.trim() !== '');
        return [...new Set(names)].sort();
    },

    async getPatients(searchTerm: string) {
        // Query unique patients from appointments (latest appointment first)
        const { data, error } = await supabase
            .from('appointments')
            .select('id, patient_name, patient_phone, patient_birth_date, hospital_id, hospital:hospitals(name)')
            .ilike('patient_name', `%${searchTerm}%`)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(25);

        if (error) {
            logger.error({ action: 'read', entity: 'appointments', error }, 'crud');
            throw error;
        }

        // De-duplicate in memory (Supabase doesn't support SELECT DISTINCT on multiple columns easily with PostgREST)
        const uniquePatients = new Map();
        data.forEach(p => {
            const key = `${p.patient_name}-${p.patient_birth_date}`;
            if (!uniquePatients.has(key)) {
                uniquePatients.set(key, {
                    id: (p as any).patient_id || p.id,
                    name: p.patient_name,
                    phone: p.patient_phone,
                    birthDate: p.patient_birth_date,
                    hospitalId: p.hospital_id,
                    hospitalName: Array.isArray(p.hospital) ? p.hospital[0]?.name : (p.hospital as any)?.name
                });
            }
        });

        return Array.from(uniquePatients.values());
    },

    async getPatientRecords(filters?: { hospitalId?: string; searchTerm?: string }) {
        // Try to fetch from the new patients table first
        let patientQuery = supabase
            .from('patients')
            .select('id, name, phone, birth_date, hospital_id, hospital:hospitals(name)');

        if (filters?.hospitalId && filters.hospitalId !== 'Todos os Hospitais') {
            patientQuery = patientQuery.eq('hospital_id', filters.hospitalId);
        }

        if (filters?.searchTerm) {
            patientQuery = patientQuery.ilike('name', `%${filters.searchTerm}%`);
        }

        const { data: patientsData, error: patientError } = await patientQuery.order('name', { ascending: true });

        const uniquePatients = new Map();

        if (!patientError && patientsData && patientsData.length > 0) {
            // Get history for these patients
            const patientIds = patientsData.map(p => p.id);
            const { data: historyData } = await supabase
                .from('appointments')
                .select('patient_id, type, status, procedure')
                .in('patient_id', patientIds);

            patientsData.forEach(p => {
                const history = (historyData || [])
                    .filter(h => h.patient_id === p.id)
                    .map(h => {
                        if (h.status === 'Falhou') return 'FALHOU';
                        if (h.status === 'Agendado') return 'AGENDADO';
                        if (h.status === 'Cancelado') return null;

                        let label = h.type || 'ATENDIMENTO';
                        if (label.toUpperCase() === 'ATENDIMENTO' && h.procedure) {
                            const proc = h.procedure.toUpperCase();
                            if (proc.includes('CONSULTA')) label = 'CONSULTA';
                            else if (proc.includes('CIRURGIA')) label = 'CIRURGIA';
                            else if (proc.includes('EXAME')) label = 'EXAMES';
                        }
                        if (label === 'EXAME') label = 'EXAMES';
                        if (h.procedure?.toUpperCase().includes('RETORNO')) label = `${label} RETORNO`;
                        return label.toUpperCase();
                    })
                    .filter(Boolean);

                const key = `${p.name}-${p.birth_date}`;
                uniquePatients.set(key, {
                    id: p.id,
                    name: p.name,
                    phone: p.phone,
                    birthDate: p.birth_date,
                    hospital_id: p.hospital_id,
                    hospital_name: Array.isArray(p.hospital) ? p.hospital[0]?.name : (p.hospital as any)?.name,
                    history: [...new Set(history)]
                });
            });
        }

        // Fallback to legacy appointment scanning (Merge with patients table data)
        let query = supabase
            .from('appointments')
            .select('patient_name, patient_phone, patient_birth_date, hospital_id, type, procedure, status, date, time, hospital:hospitals(name)');

        if (filters?.hospitalId && filters.hospitalId !== 'Todos os Hospitais') {
            query = query.eq('hospital_id', filters.hospitalId);
        }

        if (filters?.searchTerm) {
            query = query.ilike('patient_name', `%${filters.searchTerm}%`);
        }

        const { data, error } = await query.order('date', { ascending: true }).order('time', { ascending: true });
        if (error) {
            logger.error({ action: 'read', entity: 'appointments', error }, 'crud');
            throw error;
        }

        data.forEach(p => {
            const key = `${p.patient_name}-${p.patient_birth_date}`;
            if (!uniquePatients.has(key)) {
                uniquePatients.set(key, {
                    name: p.patient_name,
                    phone: p.patient_phone,
                    birthDate: p.patient_birth_date,
                    hospital_id: p.hospital_id,
                    hospital_name: Array.isArray(p.hospital) ? p.hospital[0]?.name : (p.hospital as any)?.name,
                    history: []
                });
            }

            const patient = uniquePatients.get(key);
            if (p.status === 'Falhou') {
                if (!patient.history.includes('FALHOU')) patient.history.push('FALHOU');
            } else if (p.status === 'Agendado') {
                if (!patient.history.includes('AGENDADO')) patient.history.push('AGENDADO');
            } else if (p.status === 'Atendido') {
                let label = p.type || 'ATENDIMENTO';
                if (label.toUpperCase() === 'ATENDIMENTO' && p.procedure) {
                    const proc = p.procedure.toUpperCase();
                    if (proc.includes('CONSULTA')) label = 'CONSULTA';
                    else if (proc.includes('CIRURGIA')) label = 'CIRURGIA';
                    else if (proc.includes('EXAME')) label = 'EXAMES';
                }
                if (label === 'EXAME') label = 'EXAMES';
                if (p.procedure?.toUpperCase().includes('RETORNO')) label = `${label} RETORNO`;

                label = label.toUpperCase();
                if (!patient.history.includes(label)) {
                    patient.history.push(label);
                }
            }
        });

        return Array.from(uniquePatients.values()).sort((a, b) => a.name.localeCompare(b.name));
    },

    async getPatientHistory(name: string, birthDate: string | null | undefined, patientId?: string) {
        let query = supabase
            .from('appointments')
            .select(`
                *,
                hospital:hospitals(name)
            `);

        if (patientId) {
            query = query.eq('patient_id', patientId);
        } else {
            query = query.eq('patient_name', name);
            if (birthDate && birthDate.trim() !== '') {
                query = query.eq('patient_birth_date', birthDate);
            } else {
                query = query.is('patient_birth_date', null);
            }
        }

        const { data, error } = await query
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) {
            logger.error({ action: 'read', entity: 'appointments', error }, 'crud');
            throw error;
        }
        return data;
    },

    async updatePatientPhone(name: string, birthDate: string | null | undefined, phone: string) {
        let query = supabase
            .from('appointments')
            .update({ patient_phone: phone })
            .eq('patient_name', name);

        if (birthDate && birthDate.trim() !== '') {
            query = query.eq('patient_birth_date', birthDate);
        } else {
            query = query.is('patient_birth_date', null);
        }

        const { data, error } = await query.select();

        if (error) {
            logger.error({ action: 'update', entity: 'appointments', patient_name: name, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'appointments', fields: ['patient_phone'], patient_name: name }, 'crud');
        return data;
    },

    async updatePatientHospital(name: string, birthDate: string | null | undefined, hospitalId: string) {
        let query = supabase
            .from('appointments')
            .update({ hospital_id: hospitalId })
            .eq('patient_name', name);

        if (birthDate && birthDate.trim() !== '') {
            query = query.eq('patient_birth_date', birthDate);
        } else {
            query = query.is('patient_birth_date', null);
        }

        const { data, error } = await query.select();

        if (error) {
            logger.error({ action: 'update', entity: 'appointments', patient_name: name, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'appointments', fields: ['hospital_id'], patient_name: name }, 'crud');
        return data;
    },

    async updatePayment(paymentId: string, updates: any) {
        const { data, error } = await supabase
            .from('appointment_payments')
            .update(updates)
            .eq('id', paymentId)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'appointment_payments', id: paymentId, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'appointment_payments', id: paymentId, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    }
};
