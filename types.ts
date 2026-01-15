export enum UserRole {
  ADMIN = 'ADMIN',
  RECEPTION = 'RECEPTION',
  FINANCIAL = 'FINANCIAL'
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
  paymentStatus: 'Pago' | 'Pendente' | 'Não realizado';
  cost: number;
  payments: PaymentPart[];
  notes?: string;
}

export interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  status: 'Ativo' | 'Inativo';
}
