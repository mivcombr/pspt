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

def format_date(val):
    if pd.isna(val) or val == 'NaT': return 'NULL'
    try:
        d = pd.to_datetime(val).strftime('%Y-%m-%d')
        return f"'{d}'"
    except: return 'NULL'

def clean_val(val):
    if pd.isna(val): return 'NULL'
    if isinstance(val, str):
        v = val.replace("'", "''")
        return f"'{v}'"
    return str(val)

xl = pd.ExcelFile('bd.xlsx')
df_p = pd.read_excel(xl, 'Patients')

sql = [f"DELETE FROM appointments WHERE hospital_id = '{HOSPITAL_ID}' AND patient_id IS NOT NULL;",
       f"DELETE FROM patients WHERE hospital_id = '{HOSPITAL_ID}';"]

seen = set()
for _, row in df_p.iterrows():
    p_uuid = stable_uuid(row['PatientId'])
    if p_uuid in seen: continue
    seen.add(p_uuid)
    sql.append(f"INSERT INTO patients (id, name, phone, birth_date, sex, hospital_id, user_id) VALUES ('{p_uuid}', {clean_val(row['Name'])}, {clean_val(row.get('Tel1'))}, {format_date(row.get('BirthDate'))}, {clean_val(row.get('Sex'))}, '{HOSPITAL_ID}', '{USER_ID}');")

with open('final_clean_import.sql', 'w') as f:
    f.write('\n'.join(sql))
