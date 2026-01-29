import pandas as pd
import uuid
import hashlib

HOSPITAL_ID = '410e3fd3-bd58-400f-a902-baa90473b311'
USER_ID = 'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4'

def stable_uuid(pid):
    m = hashlib.md5()
    m.update(str(pid).encode('utf-8'))
    return str(uuid.UUID(m.hexdigest()))

def clean(val):
    if pd.isna(val): return 'NULL'
    s = str(val).replace("'", "''")
    return f"'{s}'"

def clean_date(val):
    if pd.isna(val): return 'NULL'
    try:
        d = pd.to_datetime(val).strftime('%Y-%m-%d')
        return f"'{d}'"
    except:
        return 'NULL'

xl = pd.ExcelFile('bd.xlsx')
df_p = pd.read_excel(xl, 'Patients')
df_a = pd.read_excel(xl, 'Payments')

# Map PatientId to name/phone/birth for better denormalization in appointments table
patient_map = {}
for _, row in df_p.iterrows():
    patient_map[row['PatientId']] = {
        'name': row['Name'],
        'phone': row.get('Tel1'),
        'birth': row.get('BirthDate')
    }

lines = []
for _, row in df_a.iterrows():
    p_id = row['PatientId']
    p_uuid = stable_uuid(p_id)
    p_info = patient_map.get(p_id, {'name': f'ID {p_id}', 'phone': None, 'birth': None})
    
    date = row.get('ServiceDate') or row.get('PaymentDate') or '2026-01-01'
    item = row.get('ItemText', 'Consulta')
    val = row.get('ItemValue', 0)
    method = row.get('Method', 'Dinheiro')
    provider = row.get('Professional', 'HOSPI')
    
    cols = "hospital_id, date, time, patient_name, patient_phone, patient_birth_date, procedure, provider, status, payment_status, total_cost, payment_method, user_id, patient_id"
    vals = f"'{HOSPITAL_ID}', {clean_date(date)}, '08:00:00', {clean(p_info['name'])}, {clean(p_info['phone'])}, {clean_date(p_info['birth'])}, {clean(item)}, {clean(provider)}, 'Atendido', 'Pago', {val}, {clean(method)}, '{USER_ID}', '{p_uuid}'"
    
    lines.append(f"INSERT INTO appointments ({cols}) VALUES ({vals});")

with open('final_appointments.sql', 'w') as f:
    f.write('\n'.join(lines))
