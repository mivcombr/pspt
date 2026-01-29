import pandas as pd
import uuid
import hashlib

HOSPITAL_ID = '410e3fd3-bd58-400f-a902-baa90473b311'
USER_ID = 'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4'

def stable_uuid(pid):
    # Create a stable UUID based on the Excel PatientId
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
    if pd.isna(val): return 'NULL'
    try: return f"'{pd.to_datetime(val).strftime('%Y-%m-%d')}'"
    except: return 'NULL'

xl = pd.ExcelFile('bd.xlsx')
df_patients = pd.read_excel(xl, 'Patients')
df_payments = pd.read_excel(xl, 'Payments')

sql_lines = []

# Patients
for _, row in df_patients.iterrows():
    p_uuid = stable_uuid(row['PatientId'])
    cols = "id, name, phone, birth_date, sex, email, insurance, hospital_id, user_id"
    vals = f"'{p_uuid}', {clean_val(row['Name'])}, {clean_val(row.get('Tel1'))}, {format_date(row.get('BirthDate'))}, {clean_val(row.get('Sex'))}, {clean_val(row.get('Email'))}, {clean_val(row.get('Insurance'))}, '{HOSPITAL_ID}', '{USER_ID}'"
    sql_lines.append(f"INSERT INTO public.patients ({cols}) VALUES ({vals}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;")

# Appointments
for _, row in df_payments.iterrows():
    p_id = row['PatientId']
    p_uuid = stable_uuid(p_id)
    
    # Try search for patient data in Patients sheet if needed, but we used stable UUIDs
    p_matches = df_patients[df_patients['PatientId'] == p_id]
    if len(p_matches) == 0: continue
    p_data = p_matches.iloc[0]
    
    date = format_date(row.get('ServiceDate') or row.get('PaymentDate'))
    item = clean_val(row.get('ItemText', 'Consulta'))
    val = row.get('ItemValue', 0)
    method = clean_val(row.get('Method', 'Dinheiro'))
    provider = clean_val(row.get('Professional', 'HOSPI'))
    
    cols = "hospital_id, date, time, patient_name, patient_phone, patient_birth_date, procedure, provider, status, payment_status, total_cost, payment_method, user_id, patient_id"
    vals = f"'{HOSPITAL_ID}', {date}, '08:00:00', {clean_val(p_data['Name'])}, {clean_val(p_data.get('Tel1'))}, {format_date(p_data.get('BirthDate'))}, {item}, {provider}, 'Atendido', 'Pago', {val}, {method}, '{USER_ID}', '{p_uuid}'"
    sql_lines.append(f"INSERT INTO public.appointments ({cols}) VALUES ({vals});")

with open('stable_import.sql', 'w') as f:
    f.write('\n'.join(sql_lines))
