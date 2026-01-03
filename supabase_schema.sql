-- Migration SQL for Supabase (Postgres)
-- Project: PSPT Dashboard

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Hospitals Table
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Procedures Price List
CREATE TABLE procedures_price_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    standard_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cash_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    type TEXT CHECK (type IN ('Consulta', 'Exame', 'Cirurgia')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Appointments Table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    patient_birth_date TEXT,
    plan TEXT,
    type TEXT,
    procedure TEXT,
    provider TEXT,
    status TEXT DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Atendido', 'Cancelado', 'Falhou')),
    payment_status TEXT DEFAULT 'Pendente' CHECK (payment_status IN ('Pago', 'Pendente', 'Não realizado')),
    total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    repasse_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hospital_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Appointment Payments Table
CREATE TABLE appointment_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    installments INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Expense Categories Table
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    type TEXT CHECK (type IN ('Fixa', 'Variável')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Expenses Table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    category_id UUID REFERENCES expense_categories(id) ON DELETE RESTRICT,
    due_date DATE NOT NULL,
    paid_date DATE,
    value NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pago', 'Pendente')),
    recurrence TEXT DEFAULT 'Variável',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Withdrawals (Rateios) Table
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_name TEXT NOT NULL,
    date DATE NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Profiles Table (links to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('ADMIN', 'RECEPTION', 'FINANCIAL')),
    avatar_url TEXT,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach trigger to tables
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_procedures_price_list_updated_at BEFORE UPDATE ON procedures_price_list FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_hospital ON appointments(hospital_id);
CREATE INDEX idx_expenses_due_date ON expenses(due_date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_appointment_payments_appointment ON appointment_payments(appointment_id);

-- Enable RLS
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Standard Policies (Basic: Authenticated users can read most things)
CREATE POLICY "Allow public read on hospitals" ON hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on appointments" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on withdrawals" ON withdrawals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to read their own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
