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

test('equal ratings move 16 points (K=32, expected score 0.5)', () => {
  const s = byId([game(1, 2, 0)]);
  assert.equal(s[1].elo, 1016);
  assert.equal(s[2].elo, 984);
  assert.equal(s[3].elo, 1000);
});

test('an upset earns more than an expected win, and the winner gains what the loser loses', () => {
  const lead = Array.from({ length: 5 }, (_, i) => game(1, 2, i)); // player 1 pulls ahead
  const before = byId(lead);
  const upset = byId([...lead, game(2, 1, 5)]);
  const expectedWin = byId([...lead, game(1, 2, 5)]);
  assert.ok(upset[2].elo - before[2].elo > expectedWin[1].elo - before[1].elo);
  assert.ok(Math.abs(upset[2].elo - before[2].elo + (upset[1].elo - before[1].elo)) < 1e-9);
});

test('README example: 1100 vs 1000 expected score is about 0.64', () => {
  assert.ok(Math.abs(expected(1100, 1000) - 0.64) < 0.001);
});

test('a game under a minute counts for Elo and records, but not for time', () => {
  const quick = { ...game(1, 2, 0), ended_at: new Date(59_000).toISOString() };
  const s = byId([quick]);
  assert.deepEqual([s[1].played, s[1].wins, s[1].elo], [1, 1, 1016]);
  assert.deepEqual([s[1].time, s[1].timed], [0, 0]);
});

test('records, head-to-head and time; games replay in end order', () => {
  const s = byId([game(3, 1, 9), game(1, 2, 0), game(2, 1, 2), game(1, 2, 4)]);
  assert.deepEqual([s[1].wins, s[1].losses, s[1].played], [2, 2, 4]);
  assert.deepEqual(s[1].vs.get(2), { wins: 2, losses: 1 });
  assert.deepEqual(s[1].vs.get(3), { wins: 0, losses: 1 });
  assert.equal(s[1].time, 4 * 60_000);
  assert.equal(s[1].timed, 4);
  // Same games in chronological order give the same ratings.
  assert.equal(s[1].elo, byId([game(1, 2, 0), game(2, 1, 2), game(1, 2, 4), game(3, 1, 9)])[1].elo);
});
