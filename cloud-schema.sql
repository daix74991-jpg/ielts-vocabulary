-- Each authenticated account can read and change only its own notebook.
create table if not exists public.vocabulary_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null check (word_id ~ '^[0-9]{1,2}:[0-9]{1,4}$'),
  starred boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
alter table public.vocabulary_favorites enable row level security;
revoke all on public.vocabulary_favorites from anon;
grant select, insert, update on public.vocabulary_favorites to authenticated;
create policy "Read own notebook" on public.vocabulary_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own notebook entries" on public.vocabulary_favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own notebook entries" on public.vocabulary_favorites
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Keep false records as tombstones so an older device cannot resurrect an unstar.
create or replace function public.touch_vocabulary_favorite()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_vocabulary_favorite before update on public.vocabulary_favorites
for each row execute function public.touch_vocabulary_favorite();
