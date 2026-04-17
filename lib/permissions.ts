export function roleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Administrador';
    case 'ADMIN': return 'Administrador';
    case 'COMMERCIAL': return 'Comercial';
    case 'FINANCIAL': return 'Financeiro';
    case 'RECEPTION': return 'Recepção';
    default: return role;
  }
}
