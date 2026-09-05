/**
 * Matriz de RBAC e separação de funções
 * Conforme Parte 4.2 da especificação
 */

import { UserRole } from '../../domain/types.js';

export type Permission =
  // Conciliação
  | 'conciliacao:view'
  | 'conciliacao:decide'
  // Lotes & Operações
  | 'lotes:view'
  | 'lotes:manage'
  | 'lotes:close'
  | 'lotes:protocolo'
  | 'lotes:retorno_import'
  // Registros & Processos
  | 'registros:view'
  | 'registros:view_unmasked'
  | 'registros:change_status'
  | 'registros:cancel'
  // Contestações
  | 'contestacoes:view'
  | 'contestacoes:reply'
  // Financeiro & Ledger
  | 'financeiro:view_ledger'
  | 'financeiro:adjust'
  | 'financeiro:bonus'
  // Usuários & Sistema
  | 'sistema:manage_users'
  | 'sistema:config'
  | 'sistema:audit_view'
  // Parceiro
  | 'parceiro:submit_list'
  | 'parceiro:affiliate_member'
  | 'parceiro:view_own_data';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  conciliador: [
    'conciliacao:view',
    'conciliacao:decide',
    'registros:view',
  ],
  operador: [
    'lotes:view',
    'lotes:manage',
    'lotes:close',
    'lotes:protocolo',
    'lotes:retorno_import',
    'registros:view',
  ],
  suporte: [
    'contestacoes:view',
    'contestacoes:reply',
    'registros:view',
    'lotes:view',
  ],
  financeiro: [
    'financeiro:view_ledger',
    'financeiro:adjust',
    'financeiro:bonus',
    'conciliacao:view',
    'lotes:view',
    'registros:view',
  ],
  administrador: [
    'conciliacao:view',
    'conciliacao:decide',
    'lotes:view',
    'lotes:manage',
    'lotes:close',
    'lotes:protocolo',
    'lotes:retorno_import',
    'registros:view',
    'registros:view_unmasked',
    'registros:change_status',
    'registros:cancel',
    'contestacoes:view',
    'contestacoes:reply',
    'financeiro:view_ledger',
    'financeiro:adjust',
    'financeiro:bonus',
    'sistema:manage_users',
    'sistema:config',
    'sistema:audit_view',
    'parceiro:view_own_data',
  ],
  parceiro: [
    'parceiro:submit_list',
    'parceiro:affiliate_member',
    'parceiro:view_own_data',
    'lotes:view',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Acesso negado: o perfil "${role}" não possui permissão para "${permission}".`);
  }
}
