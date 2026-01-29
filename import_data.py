import pandas as pd
import uuid
import json

# Configuration
HOSPITAL_ID = '410e3fd3-bd58-400f-a902-baa90473b311'
USER_ID = 'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4'

def clean_val(val):
    if pd.isna(val):
        return 'NULL'
    if isinstance(val, str):
        safe_str = val.replace("'", "''")
        return f"'{safe_str}'"
    return str(val)

def format_date(val):
    if pd.isna(val):
        return 'NULL'
    try:
        return f"'{pd.to_datetime(val).strftime('%Y-%m-%d')}'"
    except:
        return 'NULL'

def format_time(val):
    if pd.isna(val):
        return "'08:00:00'"
    try:
        return f"'{pd.to_datetime(val).strftime('%H:%M:%S')}'"
    except:
        return "'08:00:00'"

# Load Excel
xl = pd.ExcelFile('bd.xlsx')
df_patients = pd.read_excel(xl, 'Patients')
df_apps = pd.read_excel(xl, 'Appointments')
df_payments = pd.read_excel(xl, 'Payments')

# 1. Map Patients to UUIDs
patient_map = {} # excel_id -> new_uuid
sql_patients = []

for _, row in df_patients.iterrows():
    new_id = str(uuid.uuid4())
    patient_map[row['PatientId']] = new_id
    
    name = clean_val(row['Name'])
    phone = clean_val(row.get('Tel1', ''))
    birth = format_date(row.get('BirthDate'))
    sex = clean_val(row.get('Sex', ''))
    email = clean_val(row.get('Email', ''))
    insurance = clean_val(row.get('Insurance', ''))
    
    address = clean_val(row.get('Address', ''))
    city = clean_val(row.get('Location', ''))
    state = clean_val(row.get('State', ''))
    
    sql_patients.append(f"""
    INSERT INTO public.patients (id, name, phone, birth_date, sex, email, insurance, address, city, state, hospital_id, user_id)
    VALUES ('{new_id}', {name}, {phone}, {birth}, {sex}, {email}, {insurance}, {address}, {city}, {state}, '{HOSPITAL_ID}', '{USER_ID}');
    """)

# 2. Process Appointments & Payments
# We'll prioritize the Payments sheet as it has financial data, but use Appointments for the schedule if possible.
# Actually, let's just use Payments as "Completed Appointments" since they have value and method.

sql_appointments = []

# Merge payments with patient data to get phone/birth for the appointments table (legacy fields)
for _, row in df_payments.iterrows():
    p_id = row['PatientId']
    if p_id not in patient_map:
        # If patient not in sheet, we still need to insert but maybe without patient_id link or skip
        continue
    
    p_uuid = patient_map[p_id]
    
    # Get patient details for legacy fields
    p_data = df_patients[df_patients['PatientId'] == p_id].iloc[0]
    p_name = clean_val(p_data['Name'])
    p_phone = clean_val(p_data.get('Tel1', ''))
    p_birth = format_date(p_data.get('BirthDate'))
    
    date = format_date(row.get('ServiceDate') or row.get('PaymentDate'))
    time = "'08:00:00'" # Default time
    
    item = clean_val(row.get('ItemText', 'Consulta'))
    val = row.get('ItemValue', 0)
    method = clean_val(row.get('Method', 'Dinheiro'))
    provider = clean_val(row.get('Professional', 'HOSPI'))
    
    sql_appointments.append(f"""
    INSERT INTO public.appointments (
        hospital_id, date, time, patient_name, patient_phone, patient_birth_date, 
        procedure, provider, status, payment_status, total_cost, payment_method, 
        user_id, patient_id
    ) VALUES (
        '{HOSPITAL_ID}', {date}, {time}, {p_name}, {p_phone}, {p_birth}, 
        {item}, {provider}, 'Atendido', 'Pago', {val}, {method}, 
        '{USER_ID}', '{p_uuid}'
    );
    """)

# Final SQL
with open('import_script.sql', 'w') as f:
    f.write("BEGIN;\n")
    f.write("-- Patients\n")
    f.writelines(sql_patients)
    f.write("\n-- Appointments\n")
    f.writelines(sql_appointments)
    f.write("COMMIT;\n")

print("SQL generated: import_script.sql")
