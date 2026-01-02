# Arquitetura de Módulos - Vertical Slices

Este projeto segue a arquitetura de **Vertical Slices**, onde cada domínio de negócio é isolado em seu próprio módulo com todas as camadas necessárias.

## Estrutura de um Módulo

Cada módulo em `src/modules/{nome-do-modulo}/` segue esta estrutura:

```
src/modules/{nome-do-modulo}/
├── types.ts          # Schemas Zod + Types TypeScript
├── repository.ts     # Data Layer - apenas chamadas ao Supabase
├── actions.ts        # Business Logic + Validação Zod
├── hooks/            # Custom React Hooks para consumir dados
│   └── use*.ts
├── components/       # Componentes UI específicos do módulo (opcional)
└── index.ts          # Barrel export
```

## Fluxo de Dados (Data Flow)

```
UI Component
    ↓
Custom Hook (useAuth, useGroups, useExpenses)
    ↓
Actions (validação Zod + lógica de negócio)
    ↓
Repository (queries Supabase)
    ↓
Database (protegido por RLS)
```

## Módulos Disponíveis

### 📁 `auth/`
Gerenciamento de autenticação e perfis de usuário.

**Exports principais:**
- `useAuth()` - Hook para login, signup, logout
- `authActions` - Ações de autenticação
- `User`, `LoginCredentials`, `SignupCredentials` - Types

**Exemplo de uso:**
```typescript
import { useAuth } from '@/modules/auth';

const { currentUser, login, logout, isLoading } = useAuth();
```

### 📁 `groups/`
Gerenciamento de grupos (viagens, repúblicas, eventos).

**Exports principais:**
- `useGroups(userId)` - Hook para listar/criar grupos
- `useGroup(groupId, userId)` - Hook para um grupo específico
- `Group`, `CreateGroupInput`, `UpdateGroupInput` - Types

**Exemplo de uso:**
```typescript
import { useGroups } from '@/modules/groups';

const { groups, createGroup, isLoading } = useGroups(currentUser?.id);

await createGroup({
  name: 'Viagem Cancún',
  type: 'trip',
  currency: 'USD',
  memberIds: ['user-1', 'user-2'],
});
```

### 📁 `expenses/`
Gerenciamento de despesas e divisões.

**Exports principais:**
- `useExpenses(groupIds)` - Hook para listar/criar despesas
- `Expense`, `CreateExpenseInput`, `UpdateExpenseInput` - Types
- `Payment`, `Split`, `ReceiptItem` - Types auxiliares

**Exemplo de uso:**
```typescript
import { useExpenses } from '@/modules/expenses';

const { expenses, createExpense, isLoading } = useExpenses(groupIds);

await createExpense({
  groupId: 'group-123',
  description: 'Jantar',
  amount: 150.00,
  date: '2026-01-02',
  category: 'food',
  kind: 'expense',
  payments: [{ userId: 'user-1', amount: 150 }],
  splitMode: 'equal',
  splits: [
    { userId: 'user-1', amount: 75 },
    { userId: 'user-2', amount: 75 },
  ],
}, currentUser.id);
```

## Regras de Ouro

### 1. **Tipagem Forte com Zod**
Todo input externo DEVE ser validado com Zod antes de processar:

```typescript
// ✅ CORRETO
const validated = CreateExpenseInputSchema.parse(input);

// ❌ ERRADO
const expense = input as Expense; // Sem validação!
```

### 2. **Separação de Responsabilidades**

- **types.ts**: Apenas schemas Zod e types derivados
- **repository.ts**: Apenas queries/mutations do Supabase. SEM lógica de negócio
- **actions.ts**: Validação + lógica de negócio. Chama repository
- **hooks/**: Estado React + chamadas para actions

### 3. **Multi-tenancy First**
Todo repository DEVE filtrar por `group_id` ou validar acesso do usuário:

```typescript
// ✅ CORRETO - Valida acesso antes de retornar
const isMember = await this.isUserMemberOfGroup(groupId, userId);
if (!isMember) throw new Error('Acesso negado');

// ❌ ERRADO - Retorna dados sem validar tenant
const { data } = await supabase.from('expenses').select('*');
```

### 4. **Nunca use `any`**
Use `unknown` quando não souber o tipo e valide com Zod:

```typescript
// ✅ CORRETO
async createGroup(input: unknown, userId: string) {
  const validated = CreateGroupInputSchema.parse(input);
  // ...
}

// ❌ ERRADO
async createGroup(input: any, userId: string) {
  // ...
}
```

### 5. **Tratamento de Erros Estruturado**
Actions retornam objetos com `{ data, error }`:

```typescript
// ✅ CORRETO
const result = await groupsActions.createGroup(input, userId);
if (result.error) {
  showToast(result.error, 'error');
  return;
}
// Use result.groupId

// ❌ ERRADO
try {
  const groupId = await groupsActions.createGroup(input, userId);
} catch (e) {
  alert('Erro!'); // Genérico demais
}
```

## Migrando Código Legado

Se você encontrar código nas pastas antigas (`data/`, `services/`, `store/`):

1. Identifique o domínio (auth, groups, expenses, etc)
2. Mova a lógica para o módulo correspondente
3. Adicione validação Zod
4. Remova `any` types
5. Atualize imports nas páginas

## Adicionando um Novo Módulo

1. Crie a pasta: `src/modules/{nome}/`
2. Crie `types.ts` com schemas Zod
3. Crie `repository.ts` com queries do Supabase
4. Crie `actions.ts` com validação e lógica
5. Crie `hooks/use{Nome}.ts` para consumo no React
6. Exporte tudo em `index.ts`
7. Documente aqui no README

## Configuração de Ambiente

As chaves do Supabase agora estão em variáveis de ambiente:

```bash
# .env.local
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-aqui
```

**NUNCA** commite `.env.local` no Git!
