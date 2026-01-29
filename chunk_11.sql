        user_id, patient_id
    ) VALUES (
        '410e3fd3-bd58-400f-a902-baa90473b311', '2025-10-20', '08:00:00', 'Bernardo Rogério Mata de Araújo', '86994151333', NULL, 
        'YAG LASER 2', 'hospi_teresina@programasaudeparatodos.org', 'Atendido', 'Pago', 480, 'Money', 
        'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4', 'd2524da9-c985-4f79-9aca-81215ad5ec81'
    );
    
    INSERT INTO public.appointments (
        hospital_id, date, time, patient_name, patient_phone, patient_birth_date, 
        procedure, provider, status, payment_status, total_cost, payment_method, 
        user_id, patient_id
    ) VALUES (
        '410e3fd3-bd58-400f-a902-baa90473b311', '2025-10-20', '08:00:00', 'Alaíde Francisca de Souza', '(86) 981648966', '1940-10-22', 
        'CATARATA IMPORTADA 1', 'hospi_teresina@programasaudeparatodos.org', 'Atendido', 'Pago', 3000, 'Money', 
        'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4', '846b0c40-9118-45c4-a1dd-c087ad4e4f9e'
    );
    
    INSERT INTO public.appointments (
        hospital_id, date, time, patient_name, patient_phone, patient_birth_date, 
        procedure, provider, status, payment_status, total_cost, payment_method, 
        user_id, patient_id
    ) VALUES (
        '410e3fd3-bd58-400f-a902-baa90473b311', '2025-10-20', '08:00:00', 'Alaíde Francisca de Souza', '(86) 981648966', '1940-10-22', 
        'CONSULTA CIRÚRGICA', 'hospi_teresina@programasaudeparatodos.org', 'Atendido', 'Pago', 150, 'Money', 
        'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4', '846b0c40-9118-45c4-a1dd-c087ad4e4f9e'
    );
    
    INSERT INTO public.appointments (
        hospital_id, date, time, patient_name, patient_phone, patient_birth_date, 
        procedure, provider, status, payment_status, total_cost, payment_method, 
        user_id, patient_id
    ) VALUES (
        '410e3fd3-bd58-400f-a902-baa90473b311', '2025-10-15', '08:00:00', 'Carlota Verginia Saueia', '67992751887', '1964-02-23', 
        'CONSULTA CIRÚRGICA', 'hospi_teresina@programasaudeparatodos.org', 'Atendido', 'Pago', 150, 'Money', 
        'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4', 'c9849ef9-2883-4406-ac85-7710102d2da3'
    );
    
    INSERT INTO public.appointments (
        hospital_id, date, time, patient_name, patient_phone, patient_birth_date, 
        procedure, provider, status, payment_status, total_cost, payment_method, 
        user_id, patient_id
    ) VALUES (
        '410e3fd3-bd58-400f-a902-baa90473b311', '2025-10-15', '08:00:00', 'Francisco Pereira de Almeida Silva', '(86) 995744866', '1986-03-20', 
        'CONSULTA CIRÚRGICA', 'hospi_teresina@programasaudeparatodos.org', 'Atendido', 'Pago', 150, 'Money', 
        'de6e7f78-8960-4f8c-b5b6-2754adfa2ad4', '753b06b3-f244-4ff2-8d2d-1b779e39ef92'
    );
    COMMIT;
