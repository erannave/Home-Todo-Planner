# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server with hot reload (http://localhost:3000)
bun run start            # Start production server
bun run db:seed          # Seed database with demo data
biome check --write      # Format and lint
```

## Architecture

This is a household chore management app with recurring tasks.

**Stack:** Bun runtime, Hono web framework, SQLite database, Alpine.js + Tailwind CSS frontend (via CDN)

**Structure:**
- `server/index.ts` - Hono API server with all REST endpoints
- `server/db.ts` - SQLite schema initialization (users, sessions, tasks, categories, members, task_completions)
- `public/index.html` - Single-page frontend application
- `scripts/seed.ts` - Demo data seeder

**Data Model:**
- Users own tasks, categories, and household members (multi-tenant)
- Tasks have `interval_days` for recurrence and computed status (done/pending/overdue based on `last_completed_at`)
- Task completions form an audit trail of who completed what

**Auth:** Session-based with HTTP-only cookies (Argon2id password hashing). Sessions stored in SQLite with 7-day expiry. Set `SECURE_COOKIES=false` for local network HTTP deployments.

**API Pattern:** All data endpoints require authentication via `getUserIdFromSession()`. Routes return JSON. Non-API routes fall back to `index.html` for SPA routing.

## Demo Credentials

After running `bun run db:seed`:
- Username: `demo`
- Password: `demo123`
