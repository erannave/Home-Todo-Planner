# Home Todo Planner

A household chore management app with recurring tasks, built with Bun and SQLite.

## Features

- **Recurring Tasks**: Every task has a custom repeat interval (e.g., every 3 days, every week)
- **Task Status**: Tasks show as Done (green), Due Today (yellow), or Overdue (red)
- **Household Members**: Add family members to assign tasks and track completions
- **Categories**: Organize tasks by room/area (Kitchen, Bathroom, Garden, etc.)
- **Completion History**: Track who completed what and when
- **Simple Authentication**: One account with named household members inside

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Backend**: [Hono](https://hono.dev/)
- **Database**: SQLite (Bun's built-in SQLite)
- **Frontend**: Alpine.js + Tailwind CSS (via CDN)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed

### Installation

```bash
# Install dependencies
bun install

# Seed the database with demo data (optional)
bun run db:seed

# Start the development server
bun run dev
```

The app will be available at http://localhost:3000

### Production Build

```bash
# Build standalone binary
bun run build

# Run the compiled server
./dist/server
```

### Docker

```bash
# Build the image
docker build -t home-todo-planner .

# Run with bind mount (data persists on host)
docker run -p 3000:3000 -v ./data:/app/data -e ALLOW_SIGNUPS=true home-todo-planner

# Or use a named volume
docker run -p 3000:3000 -v todo-data:/app/data -e ALLOW_SIGNUPS=true home-todo-planner
```

### Docker Compose

```bash
# Start the app
docker compose up -d

# View logs
docker compose logs -f

# Stop the app
docker compose down
```

Example `compose.yaml`:

```yaml
services:
  home-todo-planner:
    container_name: home-todo-planner
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - ALLOW_SIGNUPS=true
    restart: unless-stopped
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_PATH` | `./data/chores.db` | SQLite database path |
| `ALLOW_SIGNUPS` | `false` | Enable user registration |

### Demo Account

If you ran the seed script:
- Email: `demo@example.com`
- Password: `demo123`

## Project Structure

```
├── server/
│   ├── index.ts    # Hono API server
│   └── db.ts       # SQLite database setup
├── public/
│   └── index.html  # Frontend SPA (Alpine.js)
├── scripts/
│   └── seed.ts     # Database seeding script
└── package.json
```

## API Endpoints

### System
- `GET /api/health` - Health check endpoint
- `GET /api/config` - Public configuration (e.g., signup status)

### Authentication
- `POST /api/register` - Create new account (requires `ALLOW_SIGNUPS=true`)
- `POST /api/login` - Sign in
- `POST /api/logout` - Sign out
- `GET /api/me` - Get current user

### Tasks
- `GET /api/tasks` - List all tasks with status
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/complete` - Mark task as done

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Members
- `GET /api/members` - List household members
- `POST /api/members` - Add member
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Remove member

### History
- `GET /api/history` - Get completion history (last 100)

## License

MIT
