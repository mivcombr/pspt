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

xl = pd.ExcelFile('bd.xlsx')
df_patients = pd.read_excel(xl, 'Patients')
df_payments = pd.read_excel(xl, 'Payments')

# Filter patients that have payments or are in the patients sheet
# Actually just import everyone from both if they have data
all_pids = set(df_patients['PatientId'].unique()) | set(df_payments['PatientId'].unique())

print(f"Total unique PatientIds: {len(all_pids)}")

# Prepare patients data
patients_to_import = []
seen_ids = set()

for _, row in df_patients.iterrows():
    p_id = row['PatientId']
    p_uuid = stable_uuid(p_id)
    if p_uuid in seen_ids: continue
    seen_ids.add(p_uuid)
    
    patients_to_import.append({
        "id": p_uuid,
        "name": str(row['Name']).strip(),
        "phone": str(row.get('Tel1', '')) if pd.notna(row.get('Tel1')) else None,
        "birth_date": pd.to_datetime(row.get('BirthDate')).strftime('%Y-%m-%d') if pd.notna(row.get('BirthDate')) else None,
        "sex": str(row.get('Sex', '')) if pd.notna(row.get('Sex')) else None,
        "hospital_id": HOSPITAL_ID,
        "user_id": USER_ID
    })

# Add missing patients from payments sheet (if any)
for pid in all_pids:
    p_uuid = stable_uuid(pid)
    if p_uuid not in seen_ids:
        # We don't have their name from Patients sheet, try to find in Payments or use placeholder
        p_name = "Paciente Desconhecido"
        p_matches = df_payments[df_payments['PatientId'] == pid]
        # In this specific Excel, we don't have name in Payments. 
        # But let's check if there's a name column in Payments.
        # Based on previous view, it has ItemText, Professional, etc.
        patients_to_import.append({
            "id": p_uuid, "name": f"ID {pid}", "hospital_id": HOSPITAL_ID, "user_id": USER_ID
        })
        seen_ids.add(p_uuid)

print(f"Patients to import: {len(patients_to_import)}")

with open('clean_patients.json', 'w') as f:
    json.dump(patients_to_import, f, indent=2)
