// Chess-style (FIDE) Elo. README.md explains the formula and the constants.
export const START_ELO = 1200;
export const PROVISIONAL_GAMES = 30;
export const kFactor = (played) => (played < PROVISIONAL_GAMES ? 40 : 20);
export const expected = (rating, opponent) => 1 / (1 + 10 ** ((opponent - rating) / 400));

// Ratings are never stored. They are rebuilt by replaying every game in the
// order it ended, so the leaderboard always matches the game history.
export function computeStats(users, games) {
  const players = new Map(
    users.map((u) => [u.id, { ...u, elo: START_ELO, played: 0, wins: 0, losses: 0, time: 0, vs: new Map() }]),
  );
  const ordered = [...games].sort((a, b) => Date.parse(a.ended_at) - Date.parse(b.ended_at));

  for (const g of ordered) {
    const w = players.get(g.winner_id);
    const l = players.get(g.loser_id);
    const e = expected(w.elo, l.elo); // winner's expected score; the loser's is 1 - e
    w.elo += kFactor(w.played) * (1 - e); // winner scored 1
    l.elo -= kFactor(l.played) * (1 - e); // loser scored 0
    const ms = Date.parse(g.ended_at) - Date.parse(g.started_at);
    for (const [p, opponent, key] of [[w, l, 'wins'], [l, w, 'losses']]) {
      p.played++;
      p[key]++;
      p.time += ms;
      const h2h = p.vs.get(opponent.id) ?? { wins: 0, losses: 0 };
      h2h[key]++;
      p.vs.set(opponent.id, h2h);
    }
  }
  return [...players.values()].sort((a, b) => b.elo - a.elo || b.played - a.played);
}
