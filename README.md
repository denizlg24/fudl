# FUDL

AI-powered flag football analytics platform - a Hudl clone with route detection and game analysis.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Next.js Web   │ ──────▶ │   Elysia API     │
│   (port 3000)   │         │   (port 3002)    │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     │ Queues jobs
                                     ▼
                            ┌──────────────────┐         ┌─────────────────┐
                            │  Redis + BullMQ  │ ◀────── │   mitt-worker   │
                            │   Job Queue      │         │   (Python)      │
                            └──────────────────┘         └─────────────────┘
```

## Apps and Packages

| Name                       | Description                      | Port |
| -------------------------- | -------------------------------- | ---- |
| `web`                      | Next.js web application          | 3000 |
| `docs`                     | Next.js documentation            | 3001 |
| `@repo/api`                | Elysia API server                | 3002 |
| `mitt-worker`              | Python BullMQ job worker         | -    |
| `@repo/ui`                 | Shared React component library   | -    |
| `@repo/eslint-config`      | Shared ESLint configuration      | -    |
| `@repo/typescript-config`  | Shared TypeScript configuration  | -    |

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.3
- [Docker](https://docker.com) (for Redis)
- Python 3.11+ and [uv](https://github.com/astral-sh/uv) (for mitt-worker)
- [Envoy >= v0.1.6-hotfix](https://github.com/denizlg24/envoy) for .env versioning

## Quick Start

```bash
# Install JavaScript dependencies
bun install

# If not logged in on envoy
envy login

# Pull environment variables for root project
envy pull

# Install Python dependencies
cd apps/mitt-worker && uv sync && cd ../..

# Start everything (Docker + all apps including Python)
bun dev
```

That's it! `bun dev` starts Docker, all TypeScript apps, and the Python job worker.

## Commands

| Command               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `bun dev`             | Start Docker + all apps (web, docs, api, mitt-worker)  |
| `bun run build`       | Build all apps                                         |
| `bun run lint`        | Lint all apps                                          |
| `bun run check-types` | Type check all apps                                    |
| `bun run docker:up`   | Start Docker services (Redis) only                     |
| `bun run docker:down` | Stop Docker services                                   |
| `bun run docker:logs` | View Docker logs                                       |

---

## Python Developer Setup (mitt-worker)

The Python codebase lives in `apps/mitt-worker`. It's a BullMQ worker that processes video analysis jobs from Redis.

[uv](https://github.com/astral-sh/uv) is used for dependency management.

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

## Setting Up mitt-worker

```bash
cd apps/mitt-worker
uv sync
uv sync --all-extras  # Include dev dependencies
```

## Running mitt-worker

The worker runs automatically with `bun dev` from the project root. Turbo manages it as a separate task.

**To run manually:**

```bash
cd apps/mitt-worker
bun dev
# Or: uv run python -u -m mitt_worker
```

## Development Commands

```bash
cd apps/mitt-worker

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
apps/mitt-worker/
├── pyproject.toml
├── package.json
├── .python-version
└── src/mitt_worker/
    ├── __init__.py
    ├── __main__.py
    └── worker.py           # Worker entry point
```

## Adding ML Models

Place your model code in `src/mitt_worker/models/`. Example structure:

```python
# src/mitt_worker/models/route_detector.py
import numpy as np

class RouteDetector:
    def __init__(self):
        # Load your model weights here
        pass

    def predict(self, coordinates: list[tuple[float, float]]) -> str:
        # Your prediction logic
        return "slant"
```

Then import and use in `worker.py` to process jobs.

## Job Worker

The worker processes jobs from the BullMQ queue:

1. Video is uploaded and job is queued via Elysia API
2. Worker polls Redis for new jobs
3. Worker processes video and stores results
4. Results are retrieved via job status endpoint

The worker runs as a turborepo package and starts automatically with `bun dev`.

## Environment Variables

Environment variables are managed with **envoy**. Pull the latest `.env` files:

```bash
# Pull env file for root project
envy pull

# Pull env file for mitt-worker
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
