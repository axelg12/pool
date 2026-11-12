import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function GET() {
  return Response.json(await sql`select id, name from users order by name`);
}

export const POST = (request) =>
  write(request, (name) => sql`insert into users (name) values (${name}) returning id, name`);

export const PATCH = (request) =>
  write(request, (name, id) => sql`update users set name = ${name} where id = ${id} returning id, name`);

// Shared by add and rename: validates the name and turns a duplicate into a 409.
async function write(request, query) {
  const body = await request.json();
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 40) {
    return Response.json({ error: 'Name must be 1–40 characters' }, { status: 400 });
  }
  try {
    const [user] = await query(name, body.id);
    return user ? Response.json(user) : Response.json({ error: 'Player not found' }, { status: 404 });
  } catch (e) {
    if (e.code !== '23505') throw e; // unique_violation on lower(name)
    return Response.json({ error: `${name} already exists` }, { status: 409 });
  }
}
