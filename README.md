# 8 Puzzle Race

A mobile-friendly 8-puzzle game with solo daily challenges and real-time multiplayer races. Rooms synchronize players and round state with Supabase Realtime Broadcast + Presence; no database tables or authentication are required.

## Requirements

- Node.js and pnpm
- A Supabase project with Realtime enabled

## Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

Use the project URL and public anon/publishable key from the Supabase dashboard. Never put a Supabase service-role key in a `NEXT_PUBLIC_` variable.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js.

## Tests

```bash
pnpm test
```

This runs the Node.js tests in `lib/*.test.mjs`.

## Multiplayer rooms

Choose Multiplayer and create a room to receive a six-character code. Share the generated link (`?room=CODE`) for the easiest way to join, or enter the code manually. Rooms support 2–4 players and use Realtime Presence, so room membership is temporary and no game data is stored in a database.

The first active player in the room is the host. The host starts rounds, selects difficulty, hint settings, and a best-of series length (1, 3, or 5), and controls pause/restart. Verified placements award 3/2/1 points to the top three; players can react with four rate-limited emoji during or after a race. If the host leaves, the next active player becomes host. Restarting while other players are still racing requires confirmation.

## Deploy to Vercel

1. Push the project to a GitHub repository and import it from the Vercel dashboard, or select the repository from an existing Vercel project.
2. In **Project Settings → Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the environments you deploy.
3. Deploy with the default Next.js build settings. Vercel will build and host the app; verify the deployed URL and Supabase Realtime configuration.
