import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function GET() {
  return Response.json(await sql`select id, name from users order by name`);
}

export async function POST(request) {
  const name = String((await request.json()).name ?? '').trim();
  if (!name || name.length > 40) {
    return Response.json({ error: 'Name must be 1–40 characters' }, { status: 400 });
  }
  // A unique index on lower(name) turns duplicates into "no row returned".
  const [user] = await sql`insert into users (name) values (${name}) on conflict do nothing returning id, name`;
  return user
    ? Response.json(user, { status: 201 })
    : Response.json({ error: `${name} already exists` }, { status: 409 });
}
