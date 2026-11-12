# Dohop pool

A single-page app that keeps score of pool games at the Dohop office. It's
built for an Android tablet next to the table: large tap targets, a bottom tab
bar, and a game timer you can read from across the room.

The app has the following tabs:

- Game: pick two players, start the timer, then end the game and tap the
  winner, or cancel to discard it. The game keeps running when you switch
  tabs or reload the page.
- Leaderboard: Elo, games played, wins, losses, and win percentage for each
  player. Tap a player to see who they beat most and who beats them most.
- Players: add players.

## Run locally

```sh
npm install
npm run dev
```

`npm run dev` starts Vite with an in-memory fake API (in `vite.config.js`), so
the UI works before a database exists. The fake API loses its data when the
server restarts.

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

### Use the real database locally

```sh
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

## How Elo ratings work

The leaderboard ranks players by an Elo rating that follows the FIDE (chess)
rules. Each player has a number, and the gap between two players' numbers
predicts who wins. After each game, the winner takes points from the loser.
Beating a stronger player earns more points than beating a weaker one.

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
| Starting rating | 1200 | A common starting point. Only the gaps between ratings matter. |
| K for a player's first 30 games | 40 | New ratings move fast, so they reach the right level sooner. FIDE uses the same rule. |
| K after 30 games | 20 | Established ratings move slower, so one lucky game doesn't swing the table. |

FIDE also lowers K to 10 for players rated 2400 or more. The app leaves out
that rule because an office league doesn't produce ratings that high.

Each player uses their own K-factor. When a new player meets an established
player, the new player's rating moves twice as far as the established
player's rating. This matches FIDE, and it means the total of all ratings
doesn't stay fixed.

### Examples

- Two new players, both 1200: each expects `0.5`. With K = 40, the winner
  gains `40 × (1 − 0.5) = 20` points and the loser drops 20.
- Two established players, 1300 against 1200: the 1300 player expects `0.64`.
  If the favorite wins, the favorite gains `20 × 0.36 ≈ 7` and the underdog
  drops 7. If the underdog wins, the underdog gains `20 × 0.64 ≈ 13` and the
  favorite drops 13.
- A new player beats an established player, both 1200: the new player gains
  `40 × 0.5 = 20` and the established player drops `20 × 0.5 = 10`.

### How the app calculates ratings

The database stores players and games, not ratings. The browser rebuilds
every rating by replaying all games in the order they ended. This design has
the following benefits:

- The leaderboard always matches the game history.
- To fix a wrongly recorded game, delete its row from the `games` table. All
  later ratings recalculate.
- To change a constant, edit `START_ELO`, `PROVISIONAL_GAMES`, or `kFactor` in
  `src/stats.js`. All historical ratings recalculate with the new values.

The app stores ratings as decimals and rounds them for display.

## Project layout

| Path | Contents |
| --- | --- |
| `src/main.jsx` | The UI: tabs, game timer, leaderboard, player dialog. |
| `src/stats.js` | Elo, win and loss records, and head-to-head results. |
| `src/stats.test.js` | Tests for `src/stats.js`. Run them with `npm test`. |
| `api/users.js` | `GET` lists players. `POST` adds a player. |
| `api/games.js` | `GET` lists games. `POST` records a finished game. |
| `schema.sql` | The Postgres tables for Neon. |

The ongoing game lives in the browser's `localStorage` until it ends, so the
server stores only finished games.
