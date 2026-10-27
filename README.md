# Painel de estoque AgroLico

Primeira versão do painel web conectado ao Supabase. Inclui autenticação, visão geral, estoque por lote, busca e filtros, cadastro, edição, entradas, saídas, ajuste de saldo, arquivamento e histórico auditável.

## Configuração

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores públicos do projeto. Nunca use `service_role` no frontend.
3. Crie o usuário em **Supabase > Authentication > Users**.
4. Autorize o usuário no SQL Editor, trocando o e-mail:

```sql
insert into public.agrolico_inventory_users (user_id, display_name, role)
select id, 'Gestor AgroLico', 'manager'
from auth.users
where lower(email) = lower('gestor@agrolico.com.br')
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    active = true,
    updated_at = now();
```

Funções disponíveis: `manager`, `operator` e `viewer`.

## Executar

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:4173`.

## Segurança e integridade

- O cliente usa apenas a chave pública do Supabase.
- As tabelas operacionais permanecem sem acesso direto para `anon` e `authenticated`.
- Todas as leituras e alterações passam por RPCs `security definer` que validam `auth.uid()` e o papel ativo.
- Saídas não permitem saldo negativo.
- Itens só podem ser arquivados com saldo zero; não há exclusão física pelo painel.
- Toda criação, edição, movimentação e arquivamento gera uma linha de auditoria.
