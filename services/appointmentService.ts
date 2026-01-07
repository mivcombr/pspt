import { supabase } from '../lib/supabase';
import { Appointment } from '../types';

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

        if (error) throw error;
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

        if (error) throw error;
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

        if (error) throw error;

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
                const { data: dataWithoutUser, error: errorWithoutUser } = await supabase
                    .from('appointment_audit_logs')
                    .select('*')
                    .eq('appointment_id', appointmentId)
                    .order('changed_at', { ascending: false });

                if (errorWithoutUser) {
                    console.error('Error fetching audit logs:', errorWithoutUser);
                    return [];
                }
                return dataWithoutUser || [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error in getAuditLogs:', err);
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

        if (error) throw error;
        return data;
    },

    async deletePayment(id: string) {
        const { error } = await supabase
            .from('appointment_payments')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getDashboardData(filters: { startDate: string; endDate: string; hospitalId?: string }) {
        const start = new Date(filters.startDate + 'T00:00:00');
        const end = new Date(filters.endDate + 'T23:59:59');
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let query = supabase
            .from('appointments')
            .select(`
                total_cost, 
                repasse_value, 
                type, 
                status, 
                date,
                hospital_id,
                hospital:hospitals(name, code, location)
            `)
            .gte('date', filters.startDate)
            .lte('date', filters.endDate);

        if (filters.hospitalId && filters.hospitalId !== 'Todos os Parceiros' && filters.hospitalId !== 'Todos os Hospitais') {
            query = query.eq('hospital_id', filters.hospitalId);
        }

        const { data, error } = await query;
        if (error) throw error;

        let chartData: any[] = [];
        if (diffDays <= 31) {
            // Granularidade diária (mesmo intervalo do filtro)
            for (let i = 0; i < diffDays; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                chartData.push({
                    name: dayLabel,
                    dateKey: dateStr,
                    revenue: 0,
                    repasse: 0,
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
                    match.revenue += revenue;
                    match.repasse += repasse;
                    if (curr.type === 'CONSULTA') match.consultas++;
                    if (curr.type === 'EXAME') match.exames++;
                    if (curr.type === 'CIRURGIA') match.cirurgias++;
                }
            });
        } else {
            // Granularidade mensal (padrão 12 meses do ano selecionado)
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            chartData = months.map(month => ({
                name: month,
                revenue: 0,
                repasse: 0,
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
                chartData[monthIdx].revenue += revenue;
                chartData[monthIdx].repasse += repasse;
                if (curr.type === 'CONSULTA') chartData[monthIdx].consultas++;
                if (curr.type === 'EXAME') chartData[monthIdx].exames++;
                if (curr.type === 'CIRURGIA') chartData[monthIdx].cirurgias++;
            });
        }

        const totals = {
            revenue: 0,
            repasse: 0,
            consultas: 0,
            exames: 0,
            cirurgias: 0,
            consultas_revenue: 0,
            exames_revenue: 0,
            cirurgias_revenue: 0
        };
        const partnerMap: Record<string, any> = {};

        data.forEach(curr => {
            const revenue = Number(curr.total_cost);
            const repasse = Number(curr.repasse_value);

            totals.revenue += revenue;
            totals.repasse += repasse;
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

        const partnerBreakdown = Object.values(partnerMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { chartData, totals, partnerBreakdown };
    },

    async getProviders() {
        const { data, error } = await supabase
            .from('appointments')
            .select('provider');

        if (error) throw error;

        // Return unique names
        const names = data.map(d => d.provider).filter(p => p && p.trim() !== '');
        return [...new Set(names)].sort();
    },

    async getPatients(searchTerm: string) {
        // Query unique patients from appointments
        const { data, error } = await supabase
            .from('appointments')
            .select('patient_name, patient_phone, patient_birth_date')
            .ilike('patient_name', `%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        // De-duplicate in memory (Supabase doesn't support SELECT DISTINCT on multiple columns easily with PostgREST)
        const uniquePatients = new Map();
        data.forEach(p => {
            const key = `${p.patient_name}-${p.patient_birth_date}`;
            if (!uniquePatients.has(key)) {
                uniquePatients.set(key, {
                    name: p.patient_name,
                    phone: p.patient_phone,
                    birthDate: p.patient_birth_date
                });
            }
        });

        return Array.from(uniquePatients.values());
    },

    async getPatientRecords(filters?: { hospitalId?: string; searchTerm?: string }) {
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
        if (error) throw error;

        // De-duplicate in memory and aggregate history
        const uniquePatients = new Map();
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
            // Only show history for completed (Atendido) appointments
            if (p.type && p.status === 'Atendido') {
                let label = p.type;
                // Standardize EXAME to EXAMES for tags
                if (label === 'EXAME') label = 'EXAMES';

                if (p.procedure?.toUpperCase().includes('RETORNO')) {
                    label = `${label} RETORNO`;
                }
                patient.history.push(label);
            }
        });

        return Array.from(uniquePatients.values()).sort((a, b) => a.name.localeCompare(b.name));
    },

    async getPatientHistory(name: string, birthDate: string) {
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                hospital:hospitals(name)
            `)
            .eq('patient_name', name)
            .eq('patient_birth_date', birthDate)
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) throw error;
        return data;
    },

    async updatePatientPhone(name: string, birthDate: string, phone: string) {
        const { data, error } = await supabase
            .from('appointments')
            .update({ patient_phone: phone })
            .eq('patient_name', name)
            .eq('patient_birth_date', birthDate)
            .select();

        if (error) throw error;
        return data;
    },

    async updatePayment(paymentId: string, updates: any) {
        const { data, error } = await supabase
            .from('appointment_payments')
            .update(updates)
            .eq('id', paymentId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
