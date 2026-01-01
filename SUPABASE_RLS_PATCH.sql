-- ============================================
-- DIVIDI.AI - RLS PATCH (SEM RECURSÃO)
-- aplicar após o setup base (SUPABASE_COMPLETO.sql)
-- ============================================

-- 1) Funções helper (evitam recursão em policies)
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.profile_id = auth.uid()
      and gm.role in ('owner','admin')
  );
$$;

create or replace function public.is_profile_member_of_group(p_group_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.profile_id = p_profile_id
  );
$$;

-- Para permitir que membros vejam perfis uns dos outros (nome/avatar etc.)
create or replace function public.shares_group_with(p_other_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.profile_id = auth.uid()
      and b.profile_id = p_other_profile
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.is_profile_member_of_group(uuid, uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;

-- 2) Trigger: ao criar grupo, criador vira owner automaticamente
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    -- se o client não enviar created_by, tentamos preencher
    new.created_by := auth.uid();
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
after insert on public.groups
for each row
execute function public.handle_new_group();

-- 3) POLICIES (substituições)

-- PROFILES
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "profiles_select_self_or_shared_group"
on public.profiles for select
using (id = auth.uid() or public.shares_group_with(id));

create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid());

-- GROUPS
drop policy if exists "Users can view groups they are members of" on public.groups;
drop policy if exists "Users can insert groups" on public.groups;
drop policy if exists "Group members can update groups" on public.groups;

create policy "groups_select_member_or_owner"
on public.groups for select
using (created_by = auth.uid() or public.is_group_member(id));

create policy "groups_insert_owner"
on public.groups for insert
with check (created_by = auth.uid() or created_by is null);

-- somente admin/owner altera dados do grupo
create policy "groups_update_admin"
on public.groups for update
using (public.is_group_admin(id))
with check (public.is_group_admin(id));

-- GROUP_MEMBERS (REMOVER RECURSÃO)
drop policy if exists "Users can view members of their groups" on public.group_members;
drop policy if exists "Group members can add other members" on public.group_members;

create policy "gm_select_member"
on public.group_members for select
using (public.is_group_member(group_id));

-- somente admin/owner adiciona membros
create policy "gm_insert_admin"
on public.group_members for insert
with check (public.is_group_admin(group_id));

-- permitir sair do grupo (self-delete) e admin remover outros
drop policy if exists "gm_delete" on public.group_members;
create policy "gm_delete"
on public.group_members for delete
using (profile_id = auth.uid() or public.is_group_admin(group_id));

-- EXPENSES
drop policy if exists "Users can view expenses from their groups" on public.expenses;
drop policy if exists "Group members can insert expenses" on public.expenses;
drop policy if exists "Group members can update expenses" on public.expenses;

create policy "expenses_select_member"
on public.expenses for select
using (public.is_group_member(group_id));

create policy "expenses_insert_member"
on public.expenses for insert
with check (public.is_group_member(group_id));

-- update: criador do gasto ou admin/owner
create policy "expenses_update_creator_or_admin"
on public.expenses for update
using (created_by = auth.uid() or public.is_group_admin(group_id))
with check (created_by = auth.uid() or public.is_group_admin(group_id));

-- delete: criador do gasto ou admin/owner
drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete"
on public.expenses for delete
using (created_by = auth.uid() or public.is_group_admin(group_id));

-- EXPENSE_PAYMENTS
drop policy if exists "Users can view payments from their group expenses" on public.expense_payments;
drop policy if exists "Group members can manage payments" on public.expense_payments;

create policy "payments_select_member"
on public.expense_payments for select
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
);

create policy "payments_mutate_member"
on public.expense_payments for insert
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
      and public.is_profile_member_of_group(e.group_id, profile_id)
  )
);

drop policy if exists "payments_update" on public.expense_payments;
create policy "payments_update"
on public.expense_payments for update
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
      and public.is_profile_member_of_group(e.group_id, profile_id)
  )
);

drop policy if exists "payments_delete" on public.expense_payments;
create policy "payments_delete"
on public.expense_payments for delete
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
);

-- EXPENSE_SPLITS (mesma lógica)
drop policy if exists "Users can view splits from their group expenses" on public.expense_splits;
drop policy if exists "Group members can manage splits" on public.expense_splits;

create policy "splits_select_member"
on public.expense_splits for select
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
);

create policy "splits_insert_member"
on public.expense_splits for insert
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
      and public.is_profile_member_of_group(e.group_id, profile_id)
  )
);

drop policy if exists "splits_update" on public.expense_splits;
create policy "splits_update"
on public.expense_splits for update
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
      and public.is_profile_member_of_group(e.group_id, profile_id)
  )
);

drop policy if exists "splits_delete" on public.expense_splits;
create policy "splits_delete"
on public.expense_splits for delete
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
);

-- EXPENSE_ITEMS
drop policy if exists "Users can view items from their group expenses" on public.expense_items;
drop policy if exists "Group members can manage items" on public.expense_items;

create policy "items_select_member"
on public.expense_items for select
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
);

create policy "items_mutate_member"
on public.expense_items for all
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id)
  )
);

-- EXPENSE_TEMPLATES
drop policy if exists "Users can view templates from their groups" on public.expense_templates;
drop policy if exists "Group members can manage templates" on public.expense_templates;

create policy "templates_select_member"
on public.expense_templates for select
using (public.is_group_member(group_id));

-- gerenciamento por admin (evita qualquer membro bagunçar templates)
create policy "templates_mutate_admin"
on public.expense_templates for all
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

-- ============================================
-- ✅ PATCH RLS CONCLUÍDO!
-- ============================================
-- Próximo: Rodar o app e testar fluxo completo
-- ============================================
