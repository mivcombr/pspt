/**
 * Validates password strength and returns a list of unmet requirements.
 * Returns an empty array if all requirements are met.
 */
export function validatePassword(pwd: string): string[] {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push('mínimo 8 caracteres');
    if (!/[A-Z]/.test(pwd)) errors.push('1 letra maiúscula');
    if (!/[0-9]/.test(pwd)) errors.push('1 número');
    if (!/[^A-Za-z0-9]/.test(pwd)) errors.push('1 caractere especial');
    return errors;
}
