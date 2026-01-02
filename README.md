# FUDL

AI-powered flag football analytics platform - a Hudl clone with route detection and game analysis.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js Web   │ ──────▶ │   Elysia API     │ ──────▶ │   mitt-model    │
│   (port 3000)   │         │   (port 3002)    │         │   (port 8000)   │
└─────────────────┘         └────────┬─────────┘         └─────────────────┘
                                     │
                                     │ Long-running jobs
                                     ▼
                            ┌──────────────────┐         ┌─────────────────┐
                            │  Redis + BullMQ  │ ◀────── │   mitt-worker   │
                            │   Job Queue      │         │   (polls jobs)  │
                            └──────────────────┘         └─────────────────┘
```

## Apps and Packages

| Name                       | Description                      | Port |
| -------------------------- | -------------------------------- | ---- |
| `web`                      | Next.js web application          | 3000 |
| `docs`                     | Next.js documentation            | 3001 |
| `@repo/api`                | Elysia API server                | 3002 |
| `mitt-model`               | Python FastAPI server            | 8000 |
| `mitt-worker`              | Python BullMQ job worker         | -    |
| `@repo/ui`                 | Shared React component library   | -    |
| `@repo/eslint-config`      | Shared ESLint configuration      | -    |
| `@repo/typescript-config`  | Shared TypeScript configuration  | -    |

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.3
- [Docker](https://docker.com) (for Redis)
- Python 3.11+ and [uv](https://github.com/astral-sh/uv) (for Python apps)

## Quick Start

```bash
# Install JavaScript dependencies
bun install

# Install Python dependencies for both Python apps
cd apps/mitt-model && uv sync && cd ../..
cd apps/mitt-worker && uv sync && cd ../..

# Pull environment variables (requires envoy)
cd apps/mitt-model && envy pull && cd ../..
cd apps/mitt-worker && envy pull && cd ../..

# Start everything (Docker + all apps including Python)
bun dev
```

That's it! `bun dev` starts Docker, all TypeScript apps, the Python API server, and the job worker.

## Commands

| Command               | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `bun dev`             | Start Docker + all apps (web, docs, api, mitt-model, mitt-worker) |
| `bun run build`       | Build all apps                                                |
| `bun run lint`        | Lint all apps                                                 |
| `bun run check-types` | Type check all apps                                           |
| `bun run docker:up`   | Start Docker services (Redis) only                            |
| `bun run docker:down` | Stop Docker services                                          |
| `bun run docker:logs` | View Docker logs                                              |

## Environment Variables

Create a `.env` file in the root or in specific apps:

```env
# API Configuration
REDIS_URL=redis://localhost:6379
MITT_URL=http://localhost:8000
```

---

## Python Developer Setup

The Python codebase is split into two packages:

| Package       | Description                              | Location            |
| ------------- | ---------------------------------------- | ------------------- |
| `mitt-model`  | FastAPI server for AI/ML inference       | `apps/mitt-model`   |
| `mitt-worker` | BullMQ worker for video analysis jobs    | `apps/mitt-worker`  |

Both packages use [uv](https://github.com/astral-sh/uv) for dependency management.

## Installing uv

[uv](https://github.com/astral-sh/uv) is a fast Python package manager written in Rust.

### Windows

**With PowerShell (recommended):**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**With pip:**

```cmd
pip install uv
```

**With pipx:**

```cmd
pipx install uv
```

**With winget:**

```cmd
winget install --id=astral-sh.uv -e
```

### macOS

**With Homebrew (recommended):**

```bash
brew install uv
```

**With curl:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**With pip:**

```bash
pip install uv
```

**With pipx:**

```bash
pipx install uv
```

### Linux

**With curl (recommended):**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**With pip:**

```bash
pip install uv
```

**With pipx:**

```bash
pipx install uv
```

**Arch Linux:**

```bash
pacman -S uv
```

**Alpine Linux:**

```bash
apk add uv
```

### Verify Installation

```bash
uv --version
```

## Setting Up Python Packages

```bash
# Setup mitt-model (FastAPI server)
cd apps/mitt-model
uv sync
uv sync --all-extras  # Include dev dependencies

# Setup mitt-worker (job worker)
cd ../mitt-worker
uv sync
uv sync --all-extras  # Include dev dependencies
```

## Running Python Apps

Both Python apps run automatically with `bun dev` from the project root. Turbo manages them as separate tasks.

**To run manually:**

```bash
# Terminal 1 - FastAPI server
cd apps/mitt-model
bun dev
# Or: uv run uvicorn mitt_model.main:app --reload --port 8000

# Terminal 2 - Job worker
cd apps/mitt-worker
bun dev
# Or: uv run python -u -m mitt_worker
```

## Development Commands

```bash
# For either mitt-model or mitt-worker:
cd apps/mitt-model  # or apps/mitt-worker

# Run tests
uv run pytest

# Run linter
uv run ruff check .

# Run formatter
uv run ruff format .

# Run type checker
uv run mypy src

# Add a new dependency
uv add <package-name>

# Add a dev dependency
uv add --dev <package-name>
```

## Project Structure

```text
apps/
├── mitt-model/                 # FastAPI server
│   ├── pyproject.toml
│   ├── package.json
│   ├── .python-version
│   └── src/mitt_model/
│       ├── __init__.py
│       ├── __main__.py
│       ├── main.py             # FastAPI entry point
│       ├── api/                # API route handlers
│       └── models/             # ML models
│
└── mitt-worker/                # BullMQ job worker
    ├── pyproject.toml
    ├── package.json
    ├── .python-version
    └── src/mitt_worker/
        ├── __init__.py
        ├── __main__.py
        └── worker.py           # Worker entry point
```

## API Endpoints (mitt-model)

| Method | Endpoint   | Description                            |
| ------ | ---------- | -------------------------------------- |
| GET    | `/health`  | Health check                           |
| POST   | `/predict` | Quick inference (route classification) |

## Adding ML Models

Place your model code in `src/mitt_model/models/`. Example structure:

```python
# src/mitt_model/models/route_detector.py
import numpy as np

class RouteDetector:
    def __init__(self):
        # Load your model weights here
        pass

    def predict(self, coordinates: list[tuple[float, float]]) -> str:
        # Your prediction logic
        return "slant"
```

Then import and use in `main.py` or create new API routes.

## Job Worker (mitt-worker)

The worker processes long-running jobs from the BullMQ queue:

1. Video is uploaded and job is queued via Elysia API
2. Worker polls Redis for new jobs
3. Worker processes video and stores results
4. Results are retrieved via job status endpoint

The worker runs as a separate turborepo package and starts automatically with `bun dev`.

## Environment Variables

Environment variables are managed with **envoy**. Pull the latest `.env` files:

```bash
# Pull env files for each Python app
cd apps/mitt-model && envy pull && cd ../..
cd apps/mitt-worker && envy pull && cd ../..
```

## Troubleshooting

**uv command not found after installation:**

- Restart your terminal
- On Windows, ensure the install path is in your PATH
- Try running with full path: `~/.cargo/bin/uv` (Unix) or check installation output for path

**Python version mismatch:**

```bash
# Install Python 3.11 via uv
uv python install 3.11

# Pin the version
uv python pin 3.11
```

**Redis connection errors:**

- Ensure Redis is running: `docker ps` or `bun run docker:up`
- Ensure env vars are pulled: `cd apps/mitt-worker && envy pull`
- View logs: `bun run docker:logs`
