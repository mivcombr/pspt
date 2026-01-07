-- Create Appointment Audit Logs Table
-- This table tracks all changes made to appointments

CREATE TABLE IF NOT EXISTS appointment_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changes JSONB NOT NULL,
    previous_state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_appointment ON appointment_audit_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON appointment_audit_logs(changed_at);

-- Enable RLS
ALTER TABLE appointment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read audit logs
CREATE POLICY "Allow authenticated read on audit logs" 
    ON appointment_audit_logs 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Policy: Authenticated users can insert audit logs (for the service to log changes)
CREATE POLICY "Allow authenticated insert on audit logs" 
    ON appointment_audit_logs 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
