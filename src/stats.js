// Elo with the same constants as the old DoPool app. README.md explains it.
export const START_ELO = 1000;
export const K = 32;
export const expected = (rating, opponent) => 1 / (1 + 10 ** ((opponent - rating) / 400));

// A game under a minute was entered after it was played, not timed, so its
// result counts but its time doesn't. Returns null for those games.
export function duration(game) {
  const ms = Date.parse(game.ended_at) - Date.parse(game.started_at);
  return ms >= 60_000 ? ms : null;
}

// Ratings are never stored. They are rebuilt by replaying every game in the
// order it ended, so the leaderboard always matches the game history.
export function computeStats(users, games) {
  const players = new Map(
    users.map((u) => [u.id, { ...u, elo: START_ELO, played: 0, wins: 0, losses: 0, time: 0, timed: 0, vs: new Map() }]),
  );
  const ordered = [...games].sort((a, b) => Date.parse(a.ended_at) - Date.parse(b.ended_at));

  for (const g of ordered) {
    const w = players.get(g.winner_id);
    const l = players.get(g.loser_id);
    // The winner scored 1 against an expected score of e, so gains K × (1 − e).
    // The loser loses the same amount.
    const change = K * (1 - expected(w.elo, l.elo));
    w.elo += change;
    l.elo -= change;
    const ms = duration(g);
    for (const [p, opponent, key] of [[w, l, 'wins'], [l, w, 'losses']]) {
      p.played++;
      p[key]++;
      if (ms !== null) {
        p.time += ms;
        p.timed++;
      }
      const h2h = p.vs.get(opponent.id) ?? { wins: 0, losses: 0 };
      h2h[key]++;
      p.vs.set(opponent.id, h2h);
    }
  }
  return [...players.values()].sort((a, b) => b.elo - a.elo || b.played - a.played);
}
