export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            appointments: {
                Row: {
                    id: string
                    hospital_id: string | null
                    date: string
                    time: string
                    patient_name: string
                    patient_phone: string | null
                    patient_birth_date: string | null
                    plan: string | null
                    type: string | null
                    procedure: string | null
                    provider: string | null
                    status: string | null
                    payment_status: string | null
                    total_cost: number
                    repasse_value: number
                    hospital_value: number
                    financial_additional: number | null
                    net_value: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    hospital_id?: string | null
                    date: string
                    time: string
                    patient_name: string
                    patient_phone?: string | null
                    patient_birth_date?: string | null
                    plan?: string | null
                    type?: string | null
                    procedure?: string | null
                    provider?: string | null
                    status?: string | null
                    payment_status?: string | null
                    total_cost?: number
                    repasse_value?: number
                    hospital_value?: number
                    financial_additional?: number | null
                    net_value?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    hospital_id?: string | null
                    date?: string
                    time?: string
                    patient_name?: string
                    patient_phone?: string | null
                    patient_birth_date?: string | null
                    plan?: string | null
                    type?: string | null
                    procedure?: string | null
                    provider?: string | null
                    status?: string | null
                    payment_status?: string | null
                    total_cost?: number
                    repasse_value?: number
                    hospital_value?: number
                    financial_additional?: number | null
                    net_value?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            hospitals: {
                Row: {
                    id: string
                    name: string
                    location: string | null
                    code: string
                    status: string | null
                    color: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    location?: string | null
                    code: string
                    status?: string | null
                    color?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    location?: string | null
                    code?: string
                    status?: string | null
                    color?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            expenses: {
                Row: {
                    id: string
                    description: string
                    category_id: string | null
                    due_date: string
                    paid_date: string | null
                    value: number
                    status: string | null
                    recurrence: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    description: string
                    category_id?: string | null
                    due_date: string
                    paid_date?: string | null
                    value: number
                    status?: string | null
                    recurrence?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    description?: string
                    category_id?: string | null
                    due_date?: string
                    paid_date?: string | null
                    value?: number
                    status?: string | null
                    recurrence?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            expense_categories: {
                Row: {
                    id: string
                    name: string
                    type: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    type?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    type?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            appointment_payments: {
                Row: {
                    id: string
                    appointment_id: string | null
                    method: string
                    value: number
                    installments: number | null
                    confirmed: boolean | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    appointment_id?: string | null
                    method: string
                    value: number
                    installments?: number | null
                    confirmed?: boolean | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    appointment_id?: string | null
                    method?: string
                    value?: number
                    installments?: number | null
                    confirmed?: boolean | null
                    created_at?: string
                }
            }
            withdrawals: {
                Row: {
                    id: string
                    partner_name: string
                    date: string
                    value: number
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    partner_name: string
                    date: string
                    value: number
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    partner_name?: string
                    date?: string
                    value?: number
                    description?: string | null
                    created_at?: string
                }
            }
            profiles: {
                Row: {
                    id: string
                    name: string
                    role: string | null
                    avatar_url: string | null
                    hospital_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    name: string
                    role?: string | null
                    avatar_url?: string | null
                    hospital_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    role?: string | null
                    avatar_url?: string | null
                    hospital_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
