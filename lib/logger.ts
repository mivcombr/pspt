import pino from 'pino';

const isProd = import.meta.env.PROD;
const level = isProd ? 'silent' : (import.meta.env.VITE_LOG_LEVEL ?? 'info');

const normalizeErrorMessage = (error: unknown) => {
    if (!error) return undefined;
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && 'message' in error) {
        const maybeMessage = (error as { message?: unknown }).message;
        return typeof maybeMessage === 'string' ? maybeMessage : undefined;
    }
    return undefined;
};

export const logger = pino({
    level,
    browser: {
        asObject: true
    },
    formatters: {
        log(object) {
            const errorMessage = normalizeErrorMessage((object as { error?: unknown })?.error);
            return errorMessage ? { ...object, errorMessage } : object;
        }
    }
});
