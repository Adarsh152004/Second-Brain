-- ==============================================================================
-- Second Brain: Production Supabase PostgreSQL Schema & Optimization Migration
-- Strictly adhering to Supabase Postgres Best Practices:
--   1. schema-primary-keys: UUIDs with gen_random_uuid()
--   2. schema-data-types: timestamptz for timezones, jsonb for documents/telemetry
--   3. schema-foreign-key-indexes: Mandatory B-tree index on all FK references
--   4. query-composite-indexes & query-covering-indexes: Optimized for query plans
--   5. security-rls-performance: (select auth.uid()) subquery wrapping to avoid per-row calls
--   6. advanced-jsonb-indexing: GIN indexes using jsonb_path_ops
--   7. pgvector: HNSW indexing with vector_cosine_ops
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "pg_stat_statements";

-- 2. SESSIONS TABLE
create table if not exists public.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    title text not null default 'New Chat',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- RLS & Index for sessions
alter table public.sessions enable row level security;

create index if not exists idx_sessions_user_id on public.sessions (user_id);
create index if not exists idx_sessions_user_updated on public.sessions (user_id, updated_at desc);

create policy "Users can view their own sessions"
    on public.sessions for select
    using ((select auth.uid()) = user_id);

create policy "Users can insert their own sessions"
    on public.sessions for insert
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own sessions"
    on public.sessions for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own sessions"
    on public.sessions for delete
    using ((select auth.uid()) = user_id);


-- 3. TURNS (MESSAGES) TABLE
create table if not exists public.turns (
    id bigint generated always as identity primary key,
    session_id uuid not null references public.sessions(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    role text not null check (role in ('user', 'assistant', 'system', 'tool')),
    content text not null,
    decision jsonb default '{}'::jsonb,
    sources jsonb default '[]'::jsonb,
    created_at timestamptz not null default now()
);

-- RLS & Indexes for turns
alter table public.turns enable row level security;

-- Foreign key & composite index for fetching session thread in reverse/forward order
create index if not exists idx_turns_session_id on public.turns (session_id);
create index if not exists idx_turns_session_created on public.turns (session_id, created_at desc);
create index if not exists idx_turns_user_id on public.turns (user_id);

-- Covering index for session list preview (first user prompt)
create index if not exists idx_turns_first_prompt on public.turns (session_id, role, id asc);

-- GIN index for JSONB decision analysis / tool execution queries
create index if not exists idx_turns_decision_gin on public.turns using gin (decision jsonb_path_ops);

-- RLS Policies with optimized (select auth.uid()) caching
create policy "Users can view turns in their sessions"
    on public.turns for select
    using ((select auth.uid()) = user_id);

create policy "Users can insert turns in their sessions"
    on public.turns for insert
    with check ((select auth.uid()) = user_id);

create policy "Users can delete turns in their sessions"
    on public.turns for delete
    using ((select auth.uid()) = user_id);


-- 4. VECTOR EMBEDDINGS (KNOWLEDGE BASE CHUNKS)
create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade default auth.uid(),
    doc_id text not null,
    chunk_index integer not null,
    title text default '',
    content text not null,
    metadata jsonb default '{}'::jsonb,
    embedding vector(1024), -- Set to your Cohere / Ollama embedding dimensions
    created_at timestamptz not null default now()
);

alter table public.document_chunks enable row level security;

create index if not exists idx_chunks_user_doc on public.document_chunks (user_id, doc_id);
create index if not exists idx_chunks_doc_index on public.document_chunks (doc_id, chunk_index);

-- HNSW Vector Index for sub-millisecond semantic search
-- m=16, ef_construction=64 provides superior recall-to-build ratio
create index if not exists idx_chunks_embedding_hnsw 
    on public.document_chunks 
    using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);

create policy "Users can read own document chunks"
    on public.document_chunks for select
    using ((select auth.uid()) = user_id);

create policy "Users can manage own document chunks"
    on public.document_chunks for all
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


-- 5. MULTI-TIER LLM CACHE
create table if not exists public.llm_cache (
    cache_key text primary key,
    cache_type text not null check (cache_type in ('exact', 'semantic', 'prompt_prefix', 'tool')),
    query text not null,
    model text not null,
    response_data jsonb not null,
    embedding vector(1024),
    tokens_saved integer default 0,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);

-- Partial index for fast cache lookup & TTL sweeps
create index if not exists idx_cache_lookup on public.llm_cache (cache_type, cache_key);
create index if not exists idx_cache_active on public.llm_cache (expires_at) where expires_at > now();


-- 6. RPC: FAST HYBRID / SEMANTIC SEARCH FUNCTION
-- Matches chunks using vector cosine distance with RLS safety
create or replace function public.match_document_chunks (
    query_embedding vector(1024),
    match_threshold float default 0.6,
    match_count int default 5
)
returns table (
    id uuid,
    doc_id text,
    title text,
    content text,
    similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
    select
        c.id,
        c.doc_id,
        c.title,
        c.content,
        1 - (c.embedding <=> query_embedding) as similarity
    from public.document_chunks c
    where 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
$$;

