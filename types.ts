export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  RECEPTION = 'RECEPTION',
  FINANCIAL = 'FINANCIAL',
  COMMERCIAL = 'COMMERCIAL'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  avatar: string;
  hospitalId?: string;
  hospitalName?: string;
}

export interface PaymentPart {
  id: string;
  method: string;
  value: number;
  installments?: number;
  /** Data em que o pagamento foi recebido ('YYYY-MM-DD'). */
  paidAt?: string;
}

export interface Appointment {
  id: number | string;
  date: string; // YYYY-MM-DD
  time: string;
  patient: string;
  patientPhone?: string;
  patientBirthDate?: string;
  plan?: string;
  type: string;
  procedure: string;
  provider: string;
  hospital: string;
  hospitalId?: string;
  status: 'Agendado' | 'Atendido' | 'Cancelado' | 'Falhou';
  paymentStatus: 'Pago' | 'Parcial' | 'Pendente' | 'Não realizado';
  paymentPaidAt?: string | null;
  cost: number;
  /** Adicional do programa lançado na conciliação. Só o Financeiro edita. */
  financialAdditional?: number;
  payments: PaymentPart[];
  notes?: string;
  createdById?: string;
}

export interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  status: 'Ativo' | 'Inativo';
}

export type ProspectStage =
  | 'novo'
  | 'contato'
  | 'reuniao'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido';

export type ProspectPriority = 'Baixa' | 'Média' | 'Alta';

export interface Prospect {
  id: string;
  name: string;
  stage: ProspectStage;
  position: number;
  segment?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  source?: string | null;
  priority: ProspectPriority;
  estimated_value?: number | null;
  owner_id?: string | null;
  next_action?: string | null;
  next_action_at?: string | null; // YYYY-MM-DD
  notes?: string | null;
  lost_reason?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectActivity {
  id: string;
  prospect_id: string;
  type: 'nota' | 'ligacao' | 'reuniao' | 'email' | 'whatsapp' | 'estagio';
  content: string;
  author_id?: string | null;
  author_name?: string | null;
  created_at: string;
}
