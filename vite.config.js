import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: in-memory stand-in for api/*.js so `npm run dev` works before Neon
// is set up. It starts with sample data and resets on restart. `vercel dev`
// runs the real API instead.
const fakeApi = {
  name: 'fake-api',
  configureServer(server) {
    let nextId = 1;
    const db = { users: [], games: [] };
    for (const name of ['Axel', 'Bjarni', 'Gunna', 'Helga', 'Siggi']) db.users.push({ id: nextId++, name });
    const start = Date.now() - 86_400_000;
    [[1, 2], [1, 3], [2, 3], [3, 1], [1, 2], [4, 5], [2, 1], [1, 4], [5, 1], [3, 4], [1, 2], [2, 5]].forEach(
      ([winner_id, loser_id], i) =>
        db.games.push({
          id: nextId++,
          winner_id,
          loser_id,
          started_at: new Date(start + i * 3_600_000).toISOString(),
          ended_at: new Date(start + i * 3_600_000 + (8 + i) * 60_000).toISOString(),
        }),
    );

    server.middlewares.use('/api', async (req, res) => {
      const send = (status, body) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
      };
      const [table, query] = req.url.slice(1).split('?');
      const rows = db[table];
      if (!rows) return send(404, { error: 'Not found' });
      if (req.method === 'GET') return send(200, rows);
      if (req.method === 'DELETE') {
        const id = Number(new URLSearchParams(query).get('id'));
        db[table] = rows.filter((r) => r.id !== id);
        res.statusCode = 204;
        return res.end();
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      const row = JSON.parse(body);
      if (table === 'users') {
        row.name = row.name.trim();
        if (rows.some((u) => u.id !== row.id && u.name.toLowerCase() === row.name.toLowerCase())) {
          return send(409, { error: `${row.name} already exists` });
        }
      }
      if (req.method === 'PATCH') return send(200, Object.assign(rows.find((r) => r.id === row.id), row));
      rows.push({ id: nextId++, ...row });
      send(201, rows.at(-1));
    });
  },
};

export default defineConfig({ plugins: [react(), fakeApi] });
