import pandas as pd
import uuid
import hashlib
import json

HOSPITAL_ID = '410e3fd3-bd58-400f-a902-baa90473b311'
USER_ID = 'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4'

def stable_uuid(pid):
    m = hashlib.md5()
    m.update(str(pid).encode('utf-8'))
    return str(uuid.UUID(m.hexdigest()))

def clean_val(val):
    if pd.isna(val): return 'NULL'
    if isinstance(val, str):
        v = val.replace("'", "''")
        return f"'{v}'"
    return str(val)

def format_date(val):
    if pd.isna(val) or val == 'NaT': return 'NULL'
    try: return f"'{pd.to_datetime(val).strftime('%Y-%m-%d')}'"
    except: return 'NULL'

xl = pd.ExcelFile('bd.xlsx')
df_patients = pd.read_excel(xl, 'Patients')
df_payments = pd.read_excel(xl, 'Payments')

sql_lines = []

# Clear existing to avoid confusion (only for HOSPI)
sql_lines.append(f"DELETE FROM public.appointments WHERE hospital_id = '{HOSPITAL_ID}' AND patient_id IS NOT NULL;")
sql_lines.append(f"DELETE FROM public.patients WHERE hospital_id = '{HOSPITAL_ID}';")

# Patients
seen_pids = set()
for _, row in df_patients.iterrows():
    p_uuid = stable_uuid(row['PatientId'])
    seen_pids.add(p_uuid)
    
    cols = "id, name, phone, birth_date, sex, hospital_id, user_id"
    vals = f"'{p_uuid}', {clean_val(row['Name'])}, {clean_val(row.get('Tel1'))}, {format_date(row.get('BirthDate'))}, {clean_val(row.get('Sex'))}, '{HOSPITAL_ID}', '{USER_ID}'"
    sql_lines.append(f"INSERT INTO public.patients ({cols}) VALUES ({vals}) ON CONFLICT (id) DO NOTHING;")

# Appointments
for _, row in df_payments.iterrows():
    p_id = row['PatientId']
    p_uuid = stable_uuid(p_id)
    
    # Check if patient exists in Patients sheet to get name
    p_matches = df_patients[df_patients['PatientId'] == p_id]
    if len(p_matches) > 0:
        p_data = p_matches.iloc[0]
        p_name = p_data['Name']
        p_phone = p_data.get('Tel1')
        p_birth = p_data.get('BirthDate')
    else:
        # If not in Patients sheet, we must insert them now to avoid FKEY violation
        if p_uuid not in seen_pids:
            sql_lines.append(f"INSERT INTO public.patients (id, name, hospital_id, user_id) VALUES ('{p_uuid}', 'ID {p_id}', '{HOSPITAL_ID}', '{USER_ID}') ON CONFLICT DO NOTHING;")
            seen_pids.add(p_uuid)
        p_name = f"ID {p_id}"
        p_phone = None
        p_birth = None
    
    service_date = row.get('ServiceDate') or row.get('PaymentDate')
    if pd.isna(service_date): service_date = '2026-01-01'
    
    item = row.get('ItemText', 'Consulta')
    val = row.get('ItemValue', 0)
    method = row.get('Method', 'Dinheiro')
    provider = row.get('Professional', 'HOSPI')
    
    cols = "hospital_id, date, time, patient_name, patient_phone, patient_birth_date, procedure, provider, status, payment_status, total_cost, payment_method, user_id, patient_id"
    vals = f"'{HOSPITAL_ID}', {format_date(service_date)}, '08:00:00', {clean_val(p_name)}, {clean_val(p_phone)}, {format_date(p_birth)}, {clean_val(item)}, {clean_val(provider)}, 'Atendido', 'Pago', {val}, {clean_val(method)}, '{USER_ID}', '{p_uuid}'"
    sql_lines.append(f"INSERT INTO public.appointments ({cols}) VALUES ({vals});")

with open('final_import_all.sql', 'w') as f:
    f.write('\n'.join(sql_lines))
