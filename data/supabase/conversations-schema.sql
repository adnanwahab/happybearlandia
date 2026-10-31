create table if not exists npcs (
  id text primary key,
  name text not null,
  personality jsonb not null default '{}'::jsonb,
  current_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists npc_relationships (
  npc_id text not null references npcs(id) on delete cascade,
  player_id text not null,
  familiarity real not null default 0,
  comfort real not null default 0,
  trust real not null default 0,
  attraction real not null default 0,
  affection real not null default 0,
  fun real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (npc_id, player_id)
);

create table if not exists conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  scene_id text not null,
  npc_id text not null references npcs(id),
  player_id text not null,
  openai_conversation_id text not null,
  active boolean not null default true,
  started_at timestamptz not null default now(),
  last_turn_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists conversation_lookup
on conversation_sessions (npc_id, player_id, active);

create table if not exists conversation_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversation_sessions(id) on delete cascade,
  speaker_type text not null check (speaker_type in ('player', 'npc')),
  speaker_id text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_lookup
on conversation_messages (conversation_id, id);

create table if not exists npc_memories (
  id bigint generated always as identity primary key,
  npc_id text not null references npcs(id),
  player_id text,
  memory text not null,
  importance real not null default 0.5,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_recalled_at timestamptz
);

create table if not exists npc_goals (
  id uuid primary key default gen_random_uuid(),
  npc_id text not null references npcs(id),
  type text not null,
  target_id text,
  priority real not null default 0.5,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table npcs enable row level security;
alter table npc_relationships enable row level security;
alter table conversation_sessions enable row level security;
alter table conversation_messages enable row level security;
alter table npc_memories enable row level security;
alter table npc_goals enable row level security;
