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
df = pd.read_excel(xl, 'Patients')

lines = [
    f"DELETE FROM appointments WHERE hospital_id = '{HOSPITAL_ID}';",
    f"DELETE FROM patients WHERE hospital_id = '{HOSPITAL_ID}';"
]

seen = set()
for _, row in df.iterrows():
    p_uuid = stable_uuid(row['PatientId'])
    if p_uuid in seen: continue
    seen.add(p_uuid)
    
    vals = f"'{p_uuid}', {clean(row['Name'])}, {clean(row.get('Tel1'))}, {clean_date(row.get('BirthDate'))}, {clean(row.get('Sex'))}, '{HOSPITAL_ID}', '{USER_ID}'"
    lines.append(f"INSERT INTO patients (id, name, phone, birth_date, sex, hospital_id, user_id) VALUES ({vals});")

with open('final_clean_p.sql', 'w') as f:
    f.write('\n'.join(lines))
