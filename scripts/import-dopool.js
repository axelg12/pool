// One-off import from the old DoPool SQLite database. Prints SQL to stdout:
//
//   node scripts/import-dopool.js PATH_TO/dopool.sqlite > import.sql
//   psql "$DATABASE_URL" -f import.sql
//
// The SQL keeps the old ids and runs in one transaction, so it fails without
// changing anything if the tables already hold rows with those ids.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.argv[2], { readOnly: true });
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;

const users = db
  .prepare('select id, name from players order by id')
  .all()
  .map((p) => `  (${p.id}, ${quote(p.name.trim())})`);

const games = db
  .prepare('select * from games order by id')
  .all()
  .map((g) => {
    const end = new Date(`${g.played_at.replace(' ', 'T')}Z`); // SQLite datetime('now') is UTC
    const start = new Date(end - g.duration_seconds * 1000);
    const loser = g.winner_id === g.player1_id ? g.player2_id : g.player1_id;
    return `  (${g.id}, ${g.winner_id}, ${loser}, ${quote(start.toISOString())}, ${quote(end.toISOString())})`;
  });

console.log(`begin;
insert into users (id, name) overriding system value values
${users.join(',\n')};
insert into games (id, winner_id, loser_id, started_at, ended_at) overriding system value values
${games.join(',\n')};
select setval(pg_get_serial_sequence('users', 'id'), max(id)) from users;
select setval(pg_get_serial_sequence('games', 'id'), max(id)) from games;
commit;`);
