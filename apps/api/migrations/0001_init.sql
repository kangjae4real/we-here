create table rooms (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  name text not null check (char_length(name) between 1 and 30),
  met_on date not null,
  -- Rotated whenever a seat frees, so an old invite link stops working.
  invite_secret text not null check (invite_secret ~ '^[A-Za-z0-9_-]{22}$'),
  -- Written only by RoomAccess, which bumps it by exactly 1 per changing write.
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index rooms_expires_at on rooms (expires_at);

-- Lets an expired room answer room_expired (S8) after its rows are purged.
create table room_tombstones (
  room_id text primary key,
  expired_at timestamptz not null default now()
);

create table participants (
  id uuid primary key,
  room_id text not null references rooms on delete cascade,
  slot char(1) not null check (slot in ('A', 'B')),
  nickname text not null check (char_length(nickname) between 1 and 20),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  ai_consent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, slot),
  unique (id, room_id)
);

create table photos (
  id uuid primary key,
  room_id text not null,
  participant_id uuid not null,
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  -- The column scale is the contract's 4-decimal rounding.
  lat numeric(6, 4) not null check (lat between -90 and 90),
  lng numeric(7, 4) not null check (lng between -180 and 180),
  taken_local timestamp not null,
  tz_offset_min smallint not null check (tz_offset_min between -720 and 840),
  time_source text not null
    check (time_source in ('offset', 'kr_bounds', 'gps', 'assumed_kst')),
  uncertain boolean not null,
  uploaded_at timestamptz not null default now(),
  foreign key (participant_id, room_id)
    references participants (id, room_id) on delete cascade,
  unique (participant_id, dedupe_key)
);
create index photos_room on photos (room_id);

-- Kept apart from photos so snapshot reads never touch bytea.
create table photo_thumbs (
  photo_id uuid primary key references photos on delete cascade,
  jpeg bytea not null check (octet_length(jpeg) between 1 and 40960)
);

create table geocode_cache (
  key text primary key,
  label text not null,
  fetched_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key,
  -- Orders rows written in the same transaction, where created_at ties.
  seq bigint generated always as identity,
  room_id text not null references rooms on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  author_id uuid references participants on delete cascade,
  content text not null default '',
  evidence_ids text[] not null default '{}',
  status text not null
    check (status in ('streaming', 'complete', 'truncated', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'user') = (author_id is not null)),
  check (role = 'assistant' or status = 'complete')
);
create unique index chat_messages_room_seq on chat_messages (room_id, seq);
create unique index chat_one_streaming_per_room on chat_messages (room_id)
  where status = 'streaming';

-- Hourly room quota. Separate from chat_messages so wiping history on leave or kick keeps the count.
create table chat_reservations (
  id bigint generated always as identity primary key,
  room_id text not null references rooms on delete cascade,
  created_at timestamptz not null default now()
);
create index chat_reservations_room_time on chat_reservations (room_id, created_at);

-- Service-wide daily quota, keyed by KST date.
create table chat_usage (
  day date primary key,
  count integer not null check (count >= 0)
);
