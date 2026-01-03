-- UNBLOCK CREATION: Allow any logged-in user to CRUD everything (Reset RLS)

-- 1. HOSPITALS
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own hospitals" ON hospitals;
DROP POLICY IF EXISTS "Admins can see all hospitals" ON hospitals;
DROP POLICY IF EXISTS "Allow public read on hospitals" ON hospitals;
CREATE POLICY "Enable access for authenticated users only" ON hospitals 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- 2. APPOINTMENTS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can see all data" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated read on appointments" ON appointments;
CREATE POLICY "Enable access for authenticated users only" ON appointments 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- 3. EXPENSES
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can see all expenses" ON expenses;
DROP POLICY IF EXISTS "Allow authenticated read on expenses" ON expenses;
CREATE POLICY "Enable access for authenticated users only" ON expenses 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- 4. DOCTORS (If table exists and has RLS)
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own doctors" ON doctors;
DROP POLICY IF EXISTS "Admins can see all doctors" ON doctors;
CREATE POLICY "Enable access for authenticated users only" ON doctors
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- 5. PAYMENT & OTHERS
ALTER TABLE appointment_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own payments" ON appointment_payments;
CREATE POLICY "Enable access for authenticated users only" ON appointment_payments 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE procedures_price_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own procedures" ON procedures_price_list;
CREATE POLICY "Enable access for authenticated users only" ON procedures_price_list 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own categories" ON expense_categories;
CREATE POLICY "Enable access for authenticated users only" ON expense_categories 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Allow authenticated read on withdrawals" ON withdrawals;
CREATE POLICY "Enable access for authenticated users only" ON withdrawals 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON profiles;
CREATE POLICY "Enable access for authenticated users only" ON profiles 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');
