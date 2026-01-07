# Configuração do Histórico de Edições

## Visão Geral
A funcionalidade de **Histórico de Edições** já está implementada no código da aplicação. Ao editar um agendamento na página de ATENDIMENTOS, você pode clicar no botão "Ver Histórico de Edições" para visualizar:

- **Quem** fez a edição (nome do usuário)
- **Quando** a edição foi feita (data e hora)
- **O que** foi editado (campos alterados com valores antes/depois)

## Status da Implementação

✅ **Frontend**: Completamente implementado
- Modal de histórico de edições
- Botão "Ver Histórico de Edições" no modal de edição
- Exibição de alterações com valores antigos e novos
- Exibição do nome do usuário que fez a alteração

✅ **Backend Service**: Completamente implementado
- Função `appointmentService.update()` registra automaticamente todas as alterações
- Função `appointmentService.getAuditLogs()` busca o histórico com informações do usuário

⚠️ **Banco de Dados**: Precisa aplicar a migração

## Como Aplicar a Migração

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Cole o conteúdo do arquivo `create_audit_logs_table.sql`
6. Clique em **Run** para executar a migração

### Opção 2: Via CLI do Supabase

Se você tiver o Supabase CLI instalado:

```bash
# Execute a migração
supabase db execute --file create_audit_logs_table.sql
```

### Opção 3: Via MCP (Model Context Protocol)

Se você tiver o servidor MCP do Supabase configurado, pode usar:

```
Aplicar a migração usando o MCP com o conteúdo de create_audit_logs_table.sql
```

## O que a Migração Faz

A migração cria:

1. **Tabela `appointment_audit_logs`**:
   - `id`: Identificador único do log
   - `appointment_id`: Referência ao agendamento editado
   - `changed_by`: Referência ao usuário que fez a alteração
   - `changed_at`: Data e hora da alteração
   - `changes`: JSON com os campos alterados (antes/depois)
   - `previous_state`: JSON com o estado completo anterior do agendamento

2. **Índices** para melhor performance:
   - Índice em `appointment_id` para buscar logs de um agendamento específico
   - Índice em `changed_at` para ordenação por data

3. **Políticas RLS (Row Level Security)**:
   - Usuários autenticados podem ler os logs
   - Usuários autenticados podem inserir logs (para o serviço registrar alterações)

## Como Usar

Após aplicar a migração:

1. Vá para a página **ATENDIMENTOS**
2. Clique no ícone de **lápis** (editar) em qualquer agendamento
3. No modal de edição, clique no botão **"Ver Histórico de Edições"**
4. Você verá todas as alterações feitas naquele agendamento, incluindo:
   - Data e hora da alteração
   - Nome do usuário que fez a alteração
   - Campos alterados com valores antigos (em vermelho) e novos (em verde)

## Campos Rastreados

O sistema rastreia automaticamente alterações em todos os campos do agendamento, incluindo:

- Data e hora do agendamento
- Status (Agendado, Atendido, Falhou, Cancelado)
- Status de pagamento
- Valor total
- Procedimento
- Médico/Provedor
- Notas
- E qualquer outro campo que seja atualizado

## Observações

- As alterações são registradas **automaticamente** sempre que um agendamento é atualizado
- O histórico é **permanente** e não pode ser editado ou excluído (apenas quando o agendamento for excluído)
- Apenas usuários autenticados podem ver o histórico
- O sistema compara o estado anterior com o novo estado e registra apenas os campos que realmente mudaram
