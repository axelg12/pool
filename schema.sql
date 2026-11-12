-- Run once in the Neon SQL editor. Safe to run again.

create table if not exists users (
  id int generated always as identity primary key,
  name text not null check (length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists users_name_unique on users (lower(name));

create table if not exists games (
  id int generated always as identity primary key,
  winner_id int not null references users (id),
  loser_id int not null references users (id),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  check (winner_id <> loser_id),
  check (ended_at >= started_at)
);
