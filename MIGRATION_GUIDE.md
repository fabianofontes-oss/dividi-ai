# Guia de Migração - Código Legado → Vertical Slices

Este guia mostra como migrar código das pastas antigas para a nova arquitetura de módulos.

## 📋 Checklist de Migração

- [ ] Instalar Zod: `npm install zod`
- [ ] Criar `.env.local` com as chaves do Supabase
- [ ] Atualizar imports para usar novos módulos
- [ ] Remover código duplicado das pastas antigas
- [ ] Testar funcionalidades migradas

## 🔄 Mapeamento de Arquivos

### Antes (Estrutura Antiga)
```
├── services/
│   └── supabaseClient.ts    → src/lib/supabase.ts
├── data/
│   ├── SupabaseDataStore.ts → src/modules/{auth,groups,expenses}/repository.ts
│   └── LocalDataStore.ts    → (manter para modo offline)
├── store/
│   └── StoreContext.tsx     → src/modules/*/hooks/use*.ts
└── types.ts                 → src/modules/*/types.ts
```

### Depois (Vertical Slices)
```
src/
├── lib/
│   └── supabase.ts          # Cliente Supabase centralizado
└── modules/
    ├── auth/
    │   ├── types.ts
    │   ├── repository.ts
    │   ├── actions.ts
    │   └── hooks/useAuth.ts
    ├── groups/
    │   ├── types.ts
    │   ├── repository.ts
    │   ├── actions.ts
    │   └── hooks/useGroups.ts
    └── expenses/
        ├── types.ts
        ├── repository.ts
        ├── actions.ts
        └── hooks/useExpenses.ts
```

## 📝 Exemplos de Migração

### Exemplo 1: Migrar Autenticação

#### ❌ ANTES (StoreContext.tsx)
```typescript
import { supabase } from '../services/supabaseClient';

const [currentUser, setCurrentUser] = useState<User | null>(null);

useEffect(() => {
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setCurrentUser(mapProfileToUser(profile));
    }
  };
  initAuth();
}, []);
```

#### ✅ DEPOIS (Usando useAuth)
```typescript
import { useAuth } from '@/modules/auth';

function MyComponent() {
  const { currentUser, isLoading, error } = useAuth();
  
  if (isLoading) return <Loading />;
  if (error) return <Error message={error} />;
  
  return <div>Olá, {currentUser?.name}</div>;
}
```

### Exemplo 2: Migrar Criação de Grupo

#### ❌ ANTES (CreateGroup.tsx)
```typescript
const { addGroup } = useStore();

const handleSubmit = async () => {
  const newGroup = {
    id: crypto.randomUUID(),
    name: groupName,
    type: selectedType,
    currency: selectedCurrency,
    members: selectedMembers,
  };
  
  await addGroup(newGroup); // Sem validação!
  navigate('/groups');
};
```

#### ✅ DEPOIS (Com Validação Zod)
```typescript
import { useGroups, CreateGroupInput } from '@/modules/groups';
import { useAuth } from '@/modules/auth';

function CreateGroup() {
  const { currentUser } = useAuth();
  const { createGroup, error } = useGroups(currentUser?.id);

  const handleSubmit = async () => {
    const input: CreateGroupInput = {
      name: groupName,
      type: selectedType,
      currency: selectedCurrency,
      memberIds: selectedMembers.map(m => m.id),
    };
    
    const groupId = await createGroup(input);
    
    if (groupId) {
      navigate(`/group/${groupId}`);
    } else {
      showToast(error || 'Erro ao criar grupo', 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  );
}
```

### Exemplo 3: Migrar Listagem de Despesas

#### ❌ ANTES (Dashboard.tsx)
```typescript
const { expenses, groups } = useStore();

const recentExpenses = expenses
  .filter(e => !e.deletedAt)
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5);
```

#### ✅ DEPOIS (Com Hook Específico)
```typescript
import { useAuth } from '@/modules/auth';
import { useGroups } from '@/modules/groups';
import { useExpenses } from '@/modules/expenses';

function Dashboard() {
  const { currentUser } = useAuth();
  const { groups } = useGroups(currentUser?.id);
  const { expenses, isLoading } = useExpenses(
    groups.map(g => g.id)
  );

  const recentExpenses = expenses
    .filter(e => !e.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (isLoading) return <Loading />;

  return (
    <div>
      {recentExpenses.map(expense => (
        <ExpenseCard key={expense.id} expense={expense} />
      ))}
    </div>
  );
}
```

## 🔧 Passo a Passo Detalhado

### 1. Atualizar Imports de Supabase

Substitua:
```typescript
import { supabase } from '../services/supabaseClient';
```

Por:
```typescript
import { supabase } from '@/lib/supabase';
```

### 2. Substituir `useStore()` por Hooks Específicos

#### Para Autenticação:
```typescript
// Antes
const { currentUser, isLoadingAuth } = useStore();

// Depois
const { currentUser, isLoading } = useAuth();
```

#### Para Grupos:
```typescript
// Antes
const { groups, addGroup, updateGroup } = useStore();

// Depois
const { groups, createGroup, updateGroup } = useGroups(currentUser?.id);
```

#### Para Despesas:
```typescript
// Antes
const { expenses, addExpense, editExpense } = useStore();

// Depois
const { expenses, createExpense, updateExpense } = useExpenses(groupIds);
```

### 3. Adicionar Validação Zod

Sempre valide inputs antes de enviar para actions:

```typescript
import { CreateExpenseInputSchema } from '@/modules/expenses';

const handleSubmit = async (formData: unknown) => {
  try {
    // Valida e transforma
    const validated = CreateExpenseInputSchema.parse(formData);
    
    // Envia para action
    const expenseId = await createExpense(validated, currentUser.id);
    
    if (expenseId) {
      showToast('Despesa criada!', 'success');
    }
  } catch (error) {
    if (error instanceof ZodError) {
      showToast(error.issues[0].message, 'error');
    }
  }
};
```

### 4. Remover `any` Types

#### ❌ ANTES
```typescript
const [category, setCategory] = useState<any>('food');
const handleError = (error: any) => { ... };
```

#### ✅ DEPOIS
```typescript
import { ExpenseCategory } from '@/modules/expenses';

const [category, setCategory] = useState<ExpenseCategory>('food');
const handleError = (error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  }
};
```

## 🚨 Problemas Comuns

### Erro: "Module not found"
**Solução:** Configure path aliases no `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/modules/*": ["src/modules/*"]
    }
  }
}
```

### Erro: "VITE_SUPABASE_URL is not defined"
**Solução:** Crie `.env.local` com as variáveis:
```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-aqui
```

### Erro: Validação Zod falha
**Solução:** Verifique se os dados correspondem ao schema:
```typescript
// Debug: veja o que está falhando
try {
  const validated = MySchema.parse(data);
} catch (error) {
  if (error instanceof ZodError) {
    console.log('Erros de validação:', error.issues);
  }
}
```

## 📊 Progresso da Migração

Marque conforme migra cada parte:

- [x] Configuração inicial (Zod, .env)
- [x] Módulo `auth/`
- [x] Módulo `groups/`
- [x] Módulo `expenses/`
- [ ] Página `Login.tsx`
- [ ] Página `Dashboard.tsx`
- [ ] Página `GroupsList.tsx`
- [ ] Página `GroupDetail.tsx`
- [ ] Página `AddExpense.tsx`
- [ ] Página `EditExpense.tsx`
- [ ] Remover `store/StoreContext.tsx` (após migrar tudo)
- [ ] Remover `data/SupabaseDataStore.ts` (após migrar tudo)

## 🎯 Próximos Passos

1. Migre uma página por vez (comece pela mais simples)
2. Teste cada migração antes de continuar
3. Mantenha código legado até confirmar que tudo funciona
4. Delete arquivos antigos apenas quando 100% migrado
5. Faça commit após cada módulo migrado com sucesso

## 💡 Dicas

- Use `console.log` para debugar validações Zod
- Teste em modo guest antes de testar com Supabase
- Mantenha `.env.local` fora do Git (já está no .gitignore)
- Documente qualquer mudança de comportamento
