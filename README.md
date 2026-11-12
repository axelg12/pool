# Dohop pool

A single-page app that keeps score of pool games at the Dohop office. It's
built for a small touchscreen next to the table: large tap targets, a bottom tab
bar, and a game timer you can read from across the room.

The app has the following tabs:

- Game: pick two players and tap **Next**, then tap **Start game** when you're
  ready to break. **Pause** stops the timer, and paused time doesn't count
  toward the game time. End the game and tap the winner, or cancel to discard
  it. The app then shows how many Elo points each player gained or lost. The
  game keeps running when you switch tabs or reload the page.
- Leaderboard: Elo, games played, wins, losses, and win percentage for each
  player. Tap a player to see who they beat most and who beats them most.
- History: the 50 most recent games, newest first. Tap **Delete** to remove a
  wrongly recorded game.
- Players: add players, and tap a player to rename them.

A game shorter than a minute was entered after it was played instead of
timed. Its result counts for Elo and records, but the app ignores its time:
the History tab shows no time for it, and average game time leaves it out.

## Run locally

```sh
npm install
npm run dev
```

`npm run dev` starts Vite with an in-memory fake API (in `vite.config.js`), so
the UI works before a database exists. The fake API starts with sample players
and games, and resets when the server restarts.

To run against the real Neon database, see
[Use the real database locally](#use-the-real-database-locally).

## Deploy to Vercel with Neon

1. Import this repository in Vercel. Vercel detects the Vite framework preset
   and serves the files in `api/` as Vercel Functions.
1. In the Vercel project, go to **Storage** > **Create Database** > **Neon**,
   and connect the database to the project. Vercel adds the `DATABASE_URL`
   environment variable.
1. In the Neon console, open the SQL editor and run `schema.sql`.
1. Redeploy the project so the functions receive `DATABASE_URL`.

To use the app full screen on the tablet, open it in Chrome and select
**Add to home screen** from the menu.

The app has no login, so anyone who can open the URL can add players and
delete games.

`vercel.json` runs the functions in Frankfurt (`fra1`), the same region as the
Neon database.

### Import games from the old DoPool app

`scripts/import-dopool.js` converts the old app's SQLite database to SQL for
this schema. It keeps the old ids, so run it on an empty database:

```sh
node scripts/import-dopool.js PATH_TO/dopool.sqlite > import.sql
psql "$DATABASE_URL" -f import.sql
```

To import again, for example at cutover, first empty the tables in the Neon SQL
editor with `truncate games, users restart identity;`.

### Use the real database locally

```sh
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

## How Elo ratings work

The leaderboard ranks players by an Elo rating, the system chess uses, with the
same constants as the old DoPool app. Each player has a number, and the gap
between two players' numbers predicts who wins. After each game, the winner
takes points from the loser. Beating a stronger player earns more points than
beating a weaker one.

### Expected score

Before a game, the formula gives each player an expected score between 0
and 1, which you can read as the chance of winning:

```
E_A = 1 / (1 + 10^((R_B − R_A) / 400))
```

- `R_A`, `R_B`: the ratings of player A and player B before the game.
- `E_A`: player A's expected score. Player B's expected score is `1 − E_A`.

The 400 sets the scale. A player rated 200 points higher is expected to win
76% of games, and a player rated 400 points higher is expected to win 91%.

### Rating change

After the game, each player's rating moves by the difference between what
happened and what the formula expected:

```
R'_A = R_A + K × (S_A − E_A)
```

- `S_A`: player A's actual score: `1` for a win, `0` for a loss. Pool has no
  draws, so the app never uses `0.5`.
- `K`: the K-factor, which sets how far one game can move a rating.

### Constants

| Constant | Value | Why |
| --- | --- | --- |
| Starting rating | 1000 | Matches DoPool. Only the gaps between ratings matter. |
| K | 32 | Matches DoPool. One game moves a rating by at most 32 points. |

Every player uses the same K, no matter how many games they've played. The
winner gains exactly what the loser loses, so the average rating stays 1000.

Chess federations use a lower K, 10 to 40, because their players play
hundreds of rated games. A K of 32 lets office ratings settle after fewer
games.

### Examples

- Two players at 1000: each expects `0.5`. The winner gains
  `32 × (1 − 0.5) = 16` points, and the loser drops 16.
- A 1100 player against a 1000 player: the 1100 player expects `0.64`. If the
  favorite wins, the favorite gains `32 × 0.36 ≈ 12`, and the underdog drops
  12. If the underdog wins, the underdog gains `32 × 0.64 ≈ 20`, and the
  favorite drops 20.

### How the app calculates ratings

The database stores players and games, not ratings. The browser rebuilds
every rating by replaying all games in the order they ended. This design has
the following benefits:

- The leaderboard always matches the game history.
- To fix a wrongly recorded game, delete it in the History tab. All later
  ratings recalculate.
- To change a constant, edit `START_ELO` or `K` in `src/stats.js`. All
  historical ratings recalculate with the new values.

The old DoPool app calculated ratings the same way, so imported games give the
same ratings in both apps.

The app stores ratings as decimals and rounds them for display.

## Project layout

| Path | Contents |
| --- | --- |
| `src/main.jsx` | The UI: tabs, game timer, leaderboard, player dialog, game history. |
| `src/stats.js` | Elo, win and loss records, and head-to-head results. |
| `src/stats.test.js` | Tests for `src/stats.js`. Run them with `npm test`. |
| `api/users.js` | `GET` lists players. `POST` adds a player. `PATCH` renames a player. |
| `api/games.js` | `GET` lists games. `POST` records a finished game. `DELETE ?id=ID` deletes a game. |
| `schema.sql` | The Postgres tables for Neon. |

The ongoing game lives in the browser's `localStorage` until it ends, so the
server stores only finished games.
