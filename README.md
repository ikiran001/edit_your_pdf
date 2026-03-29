# Edit Your PDF

Full-stack PDF editor MVP: upload a PDF, annotate in the browser with **pdf.js**, merge changes with **pdf-lib** on the server, then download.

## Stack

- **Frontend:** React (Vite), Tailwind CSS v4, pdf.js
- **Backend:** Node.js, Express, multer, pdf-lib

## Run locally

Terminal 1 — API (port 3001):

```bash
cd backend && npm install && npm run dev
```

Terminal 2 — UI (port 5173, proxies `/upload`, `/edit`, `/download`, `/pdf` to 3001):

```bash
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/upload` | multipart field `file` → `{ sessionId }` |
| `GET` | `/pdf/:sessionId` | original PDF for pdf.js |
| `POST` | `/edit` | JSON `{ sessionId, edits }` → writes `edited.pdf` |
| `GET` | `/download?sessionId=` | download edited PDF (or original if never edited) |

Uploads live under `backend/uploads/<sessionId>/` and are removed automatically after about one hour.

## Project layout

- `frontend/` — Vite React app
- `backend/` — Express server, `routes/`, `services/applyEdits.js`, `utils/sessionCleanup.js`
