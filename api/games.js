import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function GET() {
  return Response.json(await sql`select * from games order by ended_at`);
}

export async function POST(request) {
  const { winner_id, loser_id, started_at, ended_at } = await request.json();
  try {
    // Foreign keys and check constraints in schema.sql reject bad games.
    const [game] = await sql`
      insert into games (winner_id, loser_id, started_at, ended_at)
      values (${winner_id}, ${loser_id}, ${started_at}, ${ended_at})
      returning *`;
    return Response.json(game, { status: 201 });
  } catch (e) {
    return Response.json({ error: `Could not save game: ${e.message}` }, { status: 400 });
  }
}

export async function DELETE(request) {
  await sql`delete from games where id = ${new URL(request.url).searchParams.get('id')}`;
  return new Response(null, { status: 204 });
}
