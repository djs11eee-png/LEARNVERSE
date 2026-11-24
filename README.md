# LEARNVERSE

An interactive programming and computer science learning observatory combining a 3D star atlas, multi-language code sandboxes, holographic collectible cards, and an AI coding assistant.

Live site: [golearnverse.com](https://golearnverse.com)

---

## Features

- **3D Star Atlas & Guided Learning Routes**
  Explore **19 major engineering and computer science tracks** mapped across **32 courses** and **128 interactive lessons** in a WebGL / Three.js observatory. Completing lessons lights up planetary nodes and records milestone progress along your chosen path.
- **In-Browser & Hardened Sandbox Code Execution**
  Edit, run, and verify exercises directly in the lesson workbench or open lab:
  - **Client-side runtimes**: JavaScript (Acorn AST + isolated worker/frame), Python (Pyodide CPython WebAssembly), SQL (`sql.js`), and live HTML/CSS previews.
  - **C & Java execution**: Run locally on Windows via `scripts/setup-lab.ps1` (GCC & JDK) or in hardened Docker micro-sandboxes (`--network=none`, `--read-only`, `--cap-drop=ALL`, seccomp profile, and concurrency semaphores tuned for 2 vCPU / 2 GiB servers).
- **Holographic Booster Packs & Card Vault**
  Unlock 5-card booster packs by completing chapters or daily study check-ins, tear open packs interactively, and browse a **90-card Card Vault** featuring distinct holographic finishes and personal study notes.
- **Seoul Node Guardian (Limited Genesis Edition)**
  The first 100 community supporters who star the repository via GitHub OAuth unlock the limited **Seoul Node Guardian** 3D holographic card, pinned in the Card Vault with a `+10` bonus to daily Vesper AI questions. OAuth tokens are used ephemerally in memory and never stored.
- **Vesper AI Coding Assistant**
  Context-aware SSE streaming assistant grounded in your current language, editor code, and runtime errors, backed by a zero-cost deterministic syntax rule engine for instant beginner feedback even without an upstream LLM API key.
- **Guest-First UX with Idempotent Cloud Sync**
  Learn, run code, and open packs immediately without an account (`localStorage` persistence). Sign up anytime (Argon2id + HS256 `HttpOnly` JWT cookies + single-use SVG captcha) to perform idempotent union sync (`POST /api/sync/union`) and join lesson discussions.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7, Three.js, Pyodide, sql.js, Acorn, Highlight.js, Lucide React |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, SQLite (WAL mode), Redis, Argon2id (`argon2-cffi`), PyJWT, HTTPX |
| **Deployment & Sandboxing** | Docker Compose, Nginx reverse proxy, Alpine Linux micro-sandboxes (`gcc`, `openjdk21`) |

---

## Project Structure

```text
.
├── backend/            # FastAPI app, SQLite WAL storage, auth, AI SSE proxy, GitHub OAuth, Docker sandbox runner
├── deploy/             # 2C2G production Docker Compose, Nginx config, and C/Java sandbox Dockerfiles + seccomp
├── docs/               # API contract and 2C2G architecture & security audit documentation
├── public/             # Static artwork, 3D textures, mascot assets, and bundled runtime licenses
├── scripts/            # Windows local lab setup/runner helpers and discussion middleware
├── src/                # React + TypeScript frontend, 3D star atlas, holographic card vault, curriculum data
├── tests/              # Node test runner and Playwright end-to-end verification suite
├── .env.example        # Production/development environment template (never commit real secrets)
├── RESOURCE_SOURCES.md # Curated learning resource catalog and upstream attribution
└── THIRD_PARTY_LICENSES.md
```

---

## Local Development

### 1. Frontend Only

Requires **Node.js 24+** (recommended). From the repository root:

```bash
npm ci
npm run dev
```

Vite serves the app at `http://127.0.0.1:5173`. Guest progress, browser JavaScript/Python/SQL/HTML execution, and the Card Vault work out of the box without a backend.

Optional Windows local C/Java lab helper (executes code under the local Windows user with GCC/JDK—only run code you trust):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-lab.ps1
```

### 2. Full Stack (Auth, Cloud Sync, Discussions & Vesper AI)

Requires **Python 3.11+**. From the repository root:

```bash
python -m venv .learnverse/venv
# Linux / macOS:
source .learnverse/venv/bin/activate
# Windows PowerShell:
# .\.learnverse\venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt
cp .env.example backend/.env
```

Update `backend/.env` for local development (generate a random key with `python -c "import secrets; print(secrets.token_hex(32))"`):

```dotenv
LEARNVERSE_ENV=development
LEARNVERSE_SQLITE_PATH=.learnverse/learnverse.sqlite
REDIS_URL=memory://
JWT_SECRET_KEY=<your-64-hex-secret>
JWT_COOKIE_SECURE=false
SANDBOX_TEMP_ROOT=.learnverse/sandbox
DEBUG=false
```

To enable upstream LLM replies for Vesper (optional—local rule-based diagnostics work with `LLM_API_KEY` left blank), set `LLM_BASE_URL` and `LLM_API_KEY` in `backend/.env`.

Start the FastAPI backend in one terminal:

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the Vite dev server proxying `/api/*` in a second terminal:

```bash
# Linux / macOS:
LEARNVERSE_BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

```powershell
# Windows PowerShell:
$env:LEARNVERSE_BACKEND_URL = "http://127.0.0.1:8000"
npm.cmd run dev
```

Health check endpoint: `http://127.0.0.1:8000/api/health`.

### 3. Production Deployment (Docker Compose + Nginx)

Production configs in [`deploy/`](./deploy) target an Ubuntu 22.04 host (2 vCPU / 2 GiB RAM):

1. Copy `.env.example` to `.env` at the repository root and configure production secrets (`JWT_SECRET_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `LLM_API_KEY`, allowed origins).
2. Build frontend static assets: `npm ci && npm run build`.
3. Build hardened C/Java micro-sandbox images and start Redis + FastAPI:

```bash
docker compose -f deploy/docker-compose.yml --profile sandbox-images build
docker compose -f deploy/docker-compose.yml up -d redis backend
```

4. Serve `dist/` and proxy `/api/*` with [`deploy/nginx/learnverse.conf`](./deploy/nginx/learnverse.conf).

---

## Building & Testing

```bash
# Type-check and build frontend bundle into dist/
npm run build

# Run frontend & Playwright E2E test suite
npm test

# Run backend unit & security tests (from backend/)
cd backend && pytest -v
```

---

## Documentation & Licensing

- **Code License**: Released under the [MIT License](./LICENSE).
- **Curriculum & Runtimes**: Upstream learning materials and bundled browser runtime licenses are cataloged in [RESOURCE_SOURCES.md](./RESOURCE_SOURCES.md) and [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
- **Architecture & API**: See [docs/API_CONTRACT.md](./docs/API_CONTRACT.md) and [docs/ARCHITECTURE_SECURITY_AUDIT.md](./docs/ARCHITECTURE_SECURITY_AUDIT.md).
