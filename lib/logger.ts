import pino from 'pino';

const level = import.meta.env.VITE_LOG_LEVEL ?? 'info';

export const logger = pino({
    level,
    browser: {
        asObject: true
    }
});
