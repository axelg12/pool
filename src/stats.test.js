import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, expected } from './stats.js';

const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
const game = (winner, loser, minute) => ({
  winner_id: winner,
  loser_id: loser,
  started_at: new Date(minute * 60_000).toISOString(),
  ended_at: new Date((minute + 1) * 60_000).toISOString(),
});
const byId = (games) => Object.fromEntries(computeStats(users, games).map((p) => [p.id, p]));

test('new players at equal rating move 20 points (K=40, expected score 0.5)', () => {
  const s = byId([game(1, 2, 0)]);
  assert.equal(s[1].elo, 1220);
  assert.equal(s[2].elo, 1180);
  assert.equal(s[3].elo, 1200);
});

test('K drops from 40 to 20 after 30 games', () => {
  const thirty = Array.from({ length: 30 }, (_, i) => (i % 2 ? game(1, 2, i) : game(2, 1, i)));
  const before = byId(thirty);
  const after = byId([...thirty, game(1, 2, 30)]);
  assert.ok(Math.abs(after[1].elo - before[1].elo - 20 * (1 - expected(before[1].elo, before[2].elo))) < 1e-9);
});

test('README example: 1300 vs 1200 expected score is about 0.64', () => {
  assert.ok(Math.abs(expected(1300, 1200) - 0.64) < 0.001);
});

test('records, head-to-head and time; games replay in end order', () => {
  const s = byId([game(3, 1, 9), game(1, 2, 0), game(2, 1, 2), game(1, 2, 4)]);
  assert.deepEqual([s[1].wins, s[1].losses, s[1].played], [2, 2, 4]);
  assert.deepEqual(s[1].vs.get(2), { wins: 2, losses: 1 });
  assert.deepEqual(s[1].vs.get(3), { wins: 0, losses: 1 });
  assert.equal(s[1].time, 4 * 60_000);
  // Same games in chronological order give the same ratings.
  assert.equal(s[1].elo, byId([game(1, 2, 0), game(2, 1, 2), game(1, 2, 4), game(3, 1, 9)])[1].elo);
});
