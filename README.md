# Local LLM Chat Studio

A clean React/Vite web client for the Local LLM Server v2 (FastAPI + llama.cpp GGUF).

## Features
- Local browser login with a seeded default `admin` / `admin` account
- Create additional local users
- Per-user chat history
- New chat, delete chat, automatic titles
- Streaming chat and copy response
- Markdown rendering for assistant responses (headings, bold/italic, links, lists, blockquotes, tables, inline code and fenced code blocks)
- Configure server URL and optional API key
- Discover models from `/v1/models`
- Configure temperature, top-p, top-k, min-p, max tokens, repeat penalty and seed
- System prompt and streaming toggle
- Settings and history persist in browser localStorage
- Responsive UI

> **Security:** this is client-side/demo authentication. Credentials, chat history and API keys are stored in browser localStorage. Do not use `admin/admin` or browser-only authentication for a production deployment.

## Default login
On first load the client creates:

- Username: `admin`
- Password: `admin`

The login page also has a **Use admin** button. Existing browser data is preserved; the admin account is added only if it does not already exist.

## Run on Windows
Requires Node.js 20+.

```powershell
npm install
npm run dev
```

If PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Connect to the Local LLM Server
Open **Settings** and enter:

- Server URL: `http://localhost:8000`
- API key: leave blank when the server has no `API_KEY`; otherwise enter the same key as the server.
- Model: click Refresh to load `/v1/models`.

The chat request uses `stream: true` when Streaming is enabled and renders SSE delta tokens as they arrive. Assistant responses are rendered as Markdown as they stream, including fenced code blocks and GFM-style tables. Model output is rendered as React elements rather than injected HTML.

## CORS
Because the browser calls the FastAPI server directly, the FastAPI server must allow the UI origin. Add this after creating the FastAPI app in `app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For a deployed UI, replace the origin with the actual UI domain. Avoid `allow_origins=["*"]` in production.

## Production recommendation
For production, replace browser-only login with SSO/OIDC and a backend-for-frontend. Keep API keys server-side, use HTTPS, and persist chat history in a database with per-user authorization.

## Run with Docker

Build the client image:

```bash
docker build -t local-llm-client .
```

Run it:

```bash
docker run --rm -p 5173:80 local-llm-client
```

Open:

```text
http://localhost:5173
```

The client runs as a static React/Vite application behind Nginx. The LLM server URL is configured from the application's settings. `VITE_DEFAULT_SERVER_URL` is a build-time Vite variable; it is not read from the container at runtime.

If the browser connects directly to a local-llm-server running on the host, use `http://localhost:8000` in the client settings. If the LLM server is another Docker container, use a browser-reachable URL rather than the Docker service name (for example, `http://localhost:8000` when port 8000 is published on the host).
