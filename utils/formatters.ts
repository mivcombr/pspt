export const APP_TIME_ZONE = 'America/Recife';

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export const formatCurrencyNoDecimals = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
};

export const parseCurrency = (val: string) => {
    if (!val) return 0;
    const clean = val.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(clean);
};

/**
 * Formata telefone para (XX) XXXXX-XXXX.
 * Aceita qualquer entrada e extrai apenas os dígitos.
 * Retorna string vazia se não houver dígitos suficientes.
 */
export const formatPhone = (value: string | null | undefined): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    // Zeros placeholder
    if (/^0+$/.test(digits)) return '';
    if (digits.length < 10) return value; // não formata se incompleto
    // 10 dígitos: adiciona o 9
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) 9${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    // 11+ dígitos: usa os primeiros 11
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

/**
 * Máscara de telefone para inputs — formata enquanto o usuário digita.
 */
export const formatPhoneMask = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

/**
 * Valida se o telefone está completo no formato (XX) XXXXX-XXXX.
 */
export const isValidPhone = (value: string | null | undefined): boolean => {
    if (!value) return false;
    return /^\(\d{2}\) \d{5}-\d{4}$/.test(value);
};

/**
 * Data de hoje no fuso do app, no formato 'YYYY-MM-DD' (para inputs date).
 */
export const todayDateOnly = (): string => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date());
    return parts; // en-CA já devolve YYYY-MM-DD
};

/**
 * Converte 'YYYY-MM-DD' em timestamp ISO ao meio-dia UTC.
 * O meio-dia evita que a conversão de fuso jogue o registro para o dia
 * anterior/seguinte ao ser exibido.
 */
export const dateOnlyToTimestamp = (date: string | null | undefined): string | null => {
    if (!date) return null;
    return `${date}T12:00:00.000Z`;
};

/**
 * Converte um timestamp (ou 'YYYY-MM-DD') para 'YYYY-MM-DD' no fuso do app.
 */
export const toDateOnly = (value: string | Date | null | undefined): string => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(d);
};

export const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';

    // If it's a string like '2024-01-01' (common from Supabase)
    if (typeof date === 'string' && date.includes('-') && !date.includes('T')) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
    }

    const d = typeof date === 'string' ? new Date(date) : date;

    // Check if date is valid
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIME_ZONE }).format(d);
};
