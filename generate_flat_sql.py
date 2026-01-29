import pandas as pd
import uuid

HOSPITAL_ID = '410e3fd3-bd58-400f-a902-baa90473b311'
USER_ID = 'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4'

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

patient_map = {}
sql_lines = []

for _, row in df_patients.iterrows():
    p_uuid = str(uuid.uuid4())
    patient_map[row['PatientId']] = p_uuid
    
    cols = "id, name, phone, birth_date, sex, email, insurance, hospital_id, user_id"
    vals = f"'{p_uuid}', {clean_val(row['Name'])}, {clean_val(row.get('Tel1'))}, {format_date(row.get('BirthDate'))}, {clean_val(row.get('Sex'))}, {clean_val(row.get('Email'))}, {clean_val(row.get('Insurance'))}, '{HOSPITAL_ID}', '{USER_ID}'"
    sql_lines.append(f"INSERT INTO public.patients ({cols}) VALUES ({vals});")

for _, row in df_payments.iterrows():
    p_id = row['PatientId']
    if p_id not in patient_map: continue
    p_uuid = patient_map[p_id]
    
    p_data = df_patients[df_patients['PatientId'] == p_id].iloc[0]
    
    date = format_date(row.get('ServiceDate') or row.get('PaymentDate'))
    item = clean_val(row.get('ItemText', 'Consulta'))
    val = row.get('ItemValue', 0)
    method = clean_val(row.get('Method', 'Dinheiro'))
    provider = clean_val(row.get('Professional', 'HOSPI'))
    
    cols = "hospital_id, date, time, patient_name, patient_phone, patient_birth_date, procedure, provider, status, payment_status, total_cost, payment_method, user_id, patient_id"
    vals = f"'{HOSPITAL_ID}', {date}, '08:00:00', {clean_val(p_data['Name'])}, {clean_val(p_data.get('Tel1'))}, {format_date(p_data.get('BirthDate'))}, {item}, {provider}, 'Atendido', 'Pago', {val}, {method}, '{USER_ID}', '{p_uuid}'"
    sql_lines.append(f"INSERT INTO public.appointments ({cols}) VALUES ({vals});")

with open('flat_import.sql', 'w') as f:
    f.write('\n'.join(sql_lines))
