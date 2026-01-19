# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server with hot reload (http://localhost:3000)
bun run start            # Start production server
bun run db:seed          # Seed database with demo data
bun test                 # Run unit tests
bun test --watch         # Run tests in watch mode
biome check --write      # Format and lint
```

## Architecture

This is a household chore management app with recurring tasks.

**Stack:** Bun runtime, Hono web framework, SQLite database, Alpine.js + Tailwind CSS frontend (via CDN)

**Structure:**
- `server/index.ts` - Hono API routes (thin routing layer)
- `server/db.ts` - SQLite schema initialization
- `server/types.ts` - Shared TypeScript type definitions
- `server/config.ts` - Environment configuration (ALLOW_SIGNUPS, SECURE_COOKIES, etc.)
- `server/services/` - Business logic layer:
  - `auth.service.ts` - Password hashing, session management, user CRUD
  - `task.service.ts` - Task CRUD, status calculation (`calculateTaskStatus`)
  - `member.service.ts` - Household member CRUD
  - `category.service.ts` - Category CRUD
  - `history.service.ts` - Completion history operations
- `server/utils/` - Pure utility functions:
  - `session.ts` - Session ID generation
  - `date.ts` - Date normalization helpers
- `server/__tests__/` - Unit tests (Bun test runner)
- `public/index.html` - Single-page frontend application
- `scripts/seed.ts` - Demo data seeder

**Data Model:**
- Users own tasks, categories, and household members (multi-tenant)
- Tasks have `interval_days` for recurrence and computed status (done/pending/overdue based on `last_completed_at`)
- Task completions form an audit trail of who completed what

**Auth:** Session-based with HTTP-only cookies (Argon2id password hashing). Sessions stored in SQLite with 7-day expiry. Set `SECURE_COOKIES=false` for local network HTTP deployments.

**API Pattern:** All data endpoints require authentication via `getUserIdFromSession()`. Routes delegate to service functions which accept an optional `db` parameter for dependency injection (enables unit testing with in-memory SQLite). Routes return JSON. Non-API routes fall back to `index.html` for SPA routing.

## Demo Credentials

After running `bun run db:seed`:
- Username: `demo`
- Password: `demo123`

## Docker

### Building and Pushing to Docker Hub

```bash
# Build the image
docker build -t erannave/home-todo-planner:latest .

# Push to Docker Hub
docker push erannave/home-todo-planner:latest

# Or build and push with a specific version tag
docker build -t erannave/home-todo-planner:v1.0.0 -t erannave/home-todo-planner:latest .
docker push erannave/home-todo-planner:v1.0.0
docker push erannave/home-todo-planner:latest
```

### Running with Docker Compose

```bash
# Create stack.env with your configuration
cp stack.env.example stack.env  # if example exists, or create manually

# Start the container
docker compose up -d
```

The `docker-compose.yml` pulls from Docker Hub (`erannave/home-todo-planner:latest`). Data is persisted to a volume at `/app/data`.

## Portainer Deployment

### Adding External Networks (e.g., Cloudflare Tunnel)

After deploying the stack in Portainer, you can connect it to external networks (like a Cloudflare tunnel network) using Portainer's web editor:

1. Go to **Stacks** → select the deployed stack
2. Click **Editor** to edit the stack configuration
3. Add the network configuration:

```yaml
services:
  home-todo:
    # ... existing config ...
    networks:
      - default
      - cloudflare-tunnel

networks:
  cloudflare-tunnel:
    external: true
```

4. Click **Update the stack**

This approach keeps the base `docker-compose.yml` portable while allowing environment-specific network configurations to be added via Portainer.
