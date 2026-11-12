import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: in-memory stand-in for api/*.js so `npm run dev` works before Neon
// is set up. Data resets on restart. `vercel dev` runs the real API instead.
const fakeApi = {
  name: 'fake-api',
  configureServer(server) {
    const db = { users: [], games: [] };
    server.middlewares.use('/api', async (req, res) => {
      const send = (status, body) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
      };
      const rows = db[req.url.replace(/^\/|\?.*$/g, '')];
      if (!rows) return send(404, { error: 'Not found' });
      if (req.method === 'GET') return send(200, rows);
      let body = '';
      for await (const chunk of req) body += chunk;
      const row = { id: rows.length + 1, ...JSON.parse(body) };
      if (rows === db.users) {
        row.name = row.name.trim();
        if (rows.some((u) => u.name.toLowerCase() === row.name.toLowerCase())) {
          return send(409, { error: `${row.name} already exists` });
        }
      }
      rows.push(row);
      send(201, row);
    });
  },
};

export default defineConfig({ plugins: [react(), fakeApi] });
