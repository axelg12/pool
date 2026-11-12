import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { computeStats, duration } from './stats.js';
import './style.css';

async function api(path, method = 'GET', body) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

const pad = (n) => String(n).padStart(2, '0');
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:${pad(Math.floor(s / 60) % 60)}` : Math.floor(s / 60)}:${pad(s % 60)}`;
}
const winPct = (p) => (p.played ? `${Math.round((100 * p.wins) / p.played)}%` : '–');
const when = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const byName = (a, b) => a.name.localeCompare(b.name);

// The ongoing game lives in localStorage, so it survives tab switches and reloads.
function storedGame() {
  try {
    return JSON.parse(localStorage.getItem('game'));
  } catch {
    return null;
  }
}

const TABS = { game: 'Game', leaderboard: 'Leaderboard', history: 'History', players: 'Players' };

function App() {
  const [tab, setTab] = useState('game');
  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [game, setGame] = useState(storedGame); // { players: [id, id], startedAt, endedAt? } in epoch ms
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = () =>
    Promise.all([api('users'), api('games')])
      .then(([u, g]) => {
        setUsers(u.sort(byName));
        setGames(g);
        setError('');
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      game ? localStorage.setItem('game', JSON.stringify(game)) : localStorage.removeItem('game');
    } catch {}
    if (!game) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [game]);

  const name = (id) => users.find((u) => u.id === id)?.name ?? '…';
  const elapsed = game ? (game.endedAt ?? now) - game.startedAt : 0;

  // Runs a server change and shows any error in the banner. Returns true on success.
  async function run(change) {
    try {
      await change();
      setError('');
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  const addUser = (newName) =>
    run(async () => {
      const u = await api('users', 'POST', { name: newName });
      setUsers((us) => [...us, u].sort(byName));
    });

  const renameUser = (id, newName) =>
    run(async () => {
      const u = await api('users', 'PATCH', { id, name: newName });
      setUsers((us) => us.map((x) => (x.id === id ? u : x)).sort(byName));
    });

  const deleteGame = (id) =>
    run(async () => {
      await api(`games?id=${id}`, 'DELETE');
      setGames((gs) => gs.filter((g) => g.id !== id));
    });

  // On failure the game stays put, so tapping the winner again retries.
  const saveGame = (winnerId) =>
    run(async () => {
      const loserId = game.players.find((id) => id !== winnerId);
      const g = await api('games', 'POST', {
        winner_id: winnerId,
        loser_id: loserId,
        started_at: new Date(game.startedAt).toISOString(),
        ended_at: new Date(game.endedAt).toISOString(),
      });
      setGames((gs) => [...gs, g]);
      setSaved(`${name(winnerId)} beat ${name(loserId)} in ${clock(elapsed)}`);
      setGame(null);
    });

  return (
    <>
      <main>
        {error && (
          <button className="error" onClick={load}>
            {error} · tap to dismiss
          </button>
        )}
        {tab === 'game' && <Game {...{ users, game, setGame, elapsed, name, saved, setSaved }} onSave={saveGame} />}
        {tab === 'leaderboard' && <Leaderboard stats={computeStats(users, games)} name={name} />}
        {tab === 'history' && <History games={games} name={name} onDelete={deleteGame} />}
        {tab === 'players' && <Players users={users} onAdd={addUser} onRename={renameUser} />}
      </main>
      <nav>
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
            {key === 'game' && game && <small>● {clock(elapsed)}</small>}
          </button>
        ))}
      </nav>
    </>
  );
}

function Game({ users, game, setGame, elapsed, name, saved, setSaved, onSave }) {
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  if (!game) {
    const toggle = (id) =>
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 2 ? [...p, id] : p));
    const start = () => {
      setGame({ players: picked, startedAt: Date.now() });
      setPicked([]);
      setSaved('');
    };
    return (
      <section>
        {saved && <p className="saved">✓ Saved: {saved}</p>}
        <header>
          <h1>{picked.length ? `${name(picked[0])} vs ${picked[1] ? name(picked[1]) : '…'}` : 'Who is playing?'}</h1>
          <button className="big primary" disabled={picked.length < 2} onClick={start}>
            Start game
          </button>
        </header>
        {users.length < 2 && <p className="muted">Add at least two players in the Players tab.</p>}
        <div className="grid">
          {users.map((u) => (
            <button key={u.id} className={`tile ${picked.includes(u.id) ? 'on' : ''}`} onClick={() => toggle(u.id)}>
              {u.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const [a, b] = game.players;
  if (!game.endedAt) {
    return (
      <section className="live">
        <h1>
          {name(a)} <span>vs</span> {name(b)}
        </h1>
        <div className="timer">{clock(elapsed)}</div>
        <div className="row">
          <button className="big danger" onClick={() => confirm('Discard this game? It will not be saved.') && setGame(null)}>
            Cancel game
          </button>
          <button className="big primary" onClick={() => setGame({ ...game, endedAt: Date.now() })}>
            End game
          </button>
        </div>
      </section>
    );
  }

  const pickWinner = async (id) => {
    setSaving(true);
    await onSave(id);
    setSaving(false);
  };
  return (
    <section className="live">
      <h1>Who won?</h1>
      <p className="muted">Game time {clock(elapsed)}</p>
      <div className="row">
        {game.players.map((id) => (
          <button key={id} className="big winner" disabled={saving} onClick={() => pickWinner(id)}>
            {name(id)}
          </button>
        ))}
      </div>
      <button className="big ghost" disabled={saving} onClick={() => setGame({ ...game, endedAt: undefined })}>
        ← Back to game
      </button>
    </section>
  );
}

function Leaderboard({ stats, name }) {
  const [selected, setSelected] = useState(null);
  if (!stats.length) return <p className="muted">No players yet. Add some in the Players tab.</p>;
  return (
    <section>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Player</th>
            <th>Elo</th>
            <th>Played</th>
            <th>W</th>
            <th>L</th>
            <th>Win %</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((p, i) => (
            <tr key={p.id} tabIndex={0} onClick={() => setSelected(p)} onKeyDown={(e) => e.key === 'Enter' && setSelected(p)}>
              <td>{i + 1}</td>
              <td className="left">{p.name}</td>
              <td className="elo">{Math.round(p.elo)}</td>
              <td>{p.played}</td>
              <td>{p.wins}</td>
              <td>{p.losses}</td>
              <td>{winPct(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && <PlayerModal player={selected} name={name} onClose={() => setSelected(null)} />}
    </section>
  );
}

function PlayerModal({ player: p, name, onClose }) {
  const ref = useRef();
  useEffect(() => ref.current.showModal(), []);
  const top = (key, label) => {
    const [id, h2h] = [...p.vs].filter(([, r]) => r[key]).sort((x, y) => y[1][key] - x[1][key])[0] ?? [];
    return (
      <div className="rival">
        <span className="muted">{label}</span>
        <b>{id ? name(id) : '—'}</b>
        {id && <span className="muted">{h2h.wins}–{h2h.losses} head-to-head</span>}
      </div>
    );
  };
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="sheet">
        <h2>{p.name}</h2>
        <p className="muted">
          {Math.round(p.elo)} Elo · {p.wins}W {p.losses}L · {winPct(p)} · avg game {p.timed ? clock(p.time / p.timed) : '–'}
        </p>
        <div className="rivals">
          {top('wins', 'Most wins against')}
          {top('losses', 'Most losses against')}
        </div>
        <button className="big" onClick={() => ref.current.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}

function History({ games, name, onDelete }) {
  if (!games.length) return <p className="muted">No games yet.</p>;
  const remove = (g) =>
    confirm(`Delete ${name(g.winner_id)} vs ${name(g.loser_id)} on ${when(g.ended_at)}? All ratings recalculate without it.`) &&
    onDelete(g.id);
  return (
    <section>
      <h1>Recent games</h1>
      <ul className="games">
        {games.slice(-50).reverse().map((g) => (
          <li key={g.id}>
            <div>
              <b>{name(g.winner_id)}</b> <span className="muted">beat</span> <b>{name(g.loser_id)}</b>
              <div className="muted">
                {when(g.ended_at)}
                {duration(g) && ` · ${clock(duration(g))}`}
              </div>
            </div>
            <button className="delete" onClick={() => remove(g)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Players({ users, onAdd, onRename }) {
  const [newName, setNewName] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (await onAdd(newName.trim())) setNewName('');
  };
  const rename = (u) => {
    const n = prompt(`Rename ${u.name}`, u.name)?.trim();
    if (n && n !== u.name) onRename(u.id, n);
  };
  return (
    <section>
      <form className="row" onSubmit={submit}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New player name"
          maxLength={40}
          autoCapitalize="words"
          required
        />
        <button className="big primary">Add player</button>
      </form>
      {users.length > 0 && <p className="muted">Tap a player to rename them.</p>}
      <div className="grid">
        {users.map((u) => (
          <button key={u.id} className="tile" onClick={() => rename(u)}>
            {u.name}
          </button>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
