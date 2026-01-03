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

    return new Intl.DateTimeFormat('pt-BR').format(d);
};

