# Edit Your PDF

Full-stack **PDF toolkit**: home hub with tool cards, **Edit PDF** (annotate + native text, server-backed), plus client-side **PDF→JPG**, **JPG→PDF**, **sign**, **unlock**, and placeholders for Word conversions.

## Stack

- **Frontend:** React (Vite), React Router, Tailwind CSS v4, pdf.js, pdf-lib (browser tools), Lucide, JSZip
- **Backend:** Node.js, Express, multer, pdf-lib; **Unlock PDF** uses **`qpdf`** when installed, otherwise **Ghostscript** (`gs`) — enough for hosts like Render’s native Node image

## Frontend layout (loosely coupled tools)

- **`src/app/`** — routing only (`AppRoutes.jsx`).
- **`src/features/<tool-id>/`** — each tool in its own folder (page + optional `*Core.js`). Prefer **no imports** between feature folders; share UI via `src/shared/`.
- **`src/shared/`** — reusable components (`ToolCard`, `ToolPageShell`, `FileDropzone`, …) and `constants/toolRegistry.js`.
- **Editor implementation** — existing `src/components/PdfEditor.jsx`, `PdfPageCanvas.jsx`, … unchanged in behavior; mounted from `features/edit-pdf/`.

## Run locally

Terminal 1 — API (port 3001):

Install **`qpdf`** for best compatibility (e.g. `brew install qpdf`, `apt install qpdf`). If `qpdf` is missing but **`gs`** (Ghostscript) is on `PATH`, unlock still works.

```bash
cd backend && npm install && npm run dev
```

Terminal 2 — UI (port 5173, proxies `/upload`, `/edit`, `/editor-state`, `/download`, `/pdf`, `/unlock-pdf` to 3001):

```bash
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/upload` | multipart field `file` → `{ sessionId }` |
| `GET` | `/pdf/:sessionId` | original PDF for pdf.js |
| `GET` | `/editor-state/:sessionId` | JSON `{ nativeTextEdits, edits }` for hydrating the editor after reload (persisted under `uploads/<sessionId>/`). |
| `POST` | `/edit` | JSON `{ sessionId, edits, applyTextSwap?, nativeTextEdits? }` → writes `edited.pdf`. Each save **rebuilds from `original.pdf`** plus merged persisted native edits and annotations so inline text is not stacked. Merges `nativeTextEdits` into `native-text-edits.json` and annotation `edits` into `session-edits.json` when the client sends non-empty pages. |
| `GET` | `/download?sessionId=` | download edited PDF (or original if never edited) |
| `POST` | `/unlock-pdf` | multipart fields `file` (PDF) and `password` → **decrypted PDF**. Prefers **`qpdf --decrypt`**, falls back to **Ghostscript** when `qpdf` is missing (e.g. Render free Node). Wrong password → `401`. |

Uploads live under `backend/uploads/<sessionId>/` and are removed automatically after about one hour.

## GitHub Pages URL (GitHub-only *website* hosting)

GitHub does **not** run your Node/Express API. It can only host the **built React app** as static files.

- **Your site URL** (after setup below) will look like:  
  **`https://ikiran001.github.io/edit_your_pdf/`**  
  (replace `ikiran001` / `edit_your_pdf` if your username or repo name differs.)

**Steps**

1. Push this repo to GitHub (including `.github/workflows/deploy-github-pages.yml`).
2. Repo **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions**.
3. Repo **Settings → Secrets and variables → Actions → New repository secret**:  
   - Name: `VITE_API_BASE_URL`  
   - Value: your public API URL, e.g. `https://your-api.onrender.com` (required for upload/edit/save; Pages alone cannot run the backend).
4. Push to `main` or `master` (or run the workflow manually). After the workflow finishes, open the URL above.

### Custom domain (cleaner URL + better Google branding)

Search results will keep showing `github.io/...` until you use your **own domain** (e.g. `letseditpdf.com`). After you add the domain in **Repo → Settings → Pages → Custom domain** and DNS is verified:

1. Add **Actions** secrets (same place as `VITE_API_BASE_URL`):
   - **`VITE_SITE_URL`** — your public origin with a trailing slash, e.g. `https://letseditpdf.com/`
   - **`VITE_BASE_PATH`** — for a site served at the domain root, use `/` (one slash). Omit both secrets to keep the default `https://<user>.github.io/<repo>/` behavior.
2. Re-run **Deploy frontend to GitHub Pages**.

Local production build with a custom domain:  
`cd frontend && VITE_BASE_PATH=/ VITE_SITE_URL=https://letseditpdf.com/ VITE_API_BASE_URL=https://your-api.example.com npm run build`

Local build matching Pages:  
`cd frontend && VITE_BASE_PATH=/edit_your_pdf/ VITE_API_BASE_URL=https://your-api.example.com npm run build`

### Google Analytics (optional)

The app loads **GA4** via [gtag.js](https://developers.google.com/tag-platform/gtagjs) (`src/lib/analytics.js`). The Measurement ID is set in **`frontend/.env.production`** as `VITE_GA_MEASUREMENT_ID` and baked in at **`npm run build`** (including GitHub Pages).

To use a different property, edit that file (or override with `VITE_GA_MEASUREMENT_ID=…` in the shell when building). For **`npm run dev`**, Vite does not load `.env.production`; use **`frontend/.env.local`** with the same variable if you want hits while developing.

Virtual page paths sent to GA: `/` (landing) and `/edit` (after upload).

### Google Search Console verification (HTML meta tag)

Google asks you to add a **meta tag** to your site’s home page `<head>`. This project’s home page is `frontend/index.html` (Vite copies it into `dist/index.html` when you build).

**Recommended (no token in git):**

1. In Search Console, choose **HTML tag** and copy only the **`content`** value (the long string inside `content="…"`).
2. **GitHub Pages:** add repository secret **`VITE_GOOGLE_SITE_VERIFICATION`** with that string (no quotes), then re-run **Deploy frontend to GitHub Pages**. The workflow injects it at build time.
3. **Local preview of production HTML:**  
   `VITE_GOOGLE_SITE_VERIFICATION=your_token_here npm run build`  
   then open `frontend/dist/index.html` or run `npm run preview` and confirm View Source shows  
   `<meta name="google-site-verification" content="your_token_here" />`.

**Alternative:** edit `frontend/index.html` and set `content="…"` to your full token directly (replace the `%VITE_GOOGLE_SITE_VERIFICATION%` placeholder with the token only). Commit that only if you accept the token living in the repo.

After the **live** site serves the tag, return to Search Console and click **Verify**. Leave the meta tag in place after verification.

**If upload shows `405` and Network tab shows `POST https://…github.io/upload`**  
The live build has **no** API URL. The secret `VITE_API_BASE_URL` is missing or the workflow was not re-run after you added it. Add the secret, then **Actions → Deploy frontend to GitHub Pages → Run workflow**.

---

## Share it on the internet (full app)

GitHub only stores code unless you use Pages for the **frontend** as above. You still need a **public host** for the Node API.

**Typical setup (two free tiers):**

1. **Backend** on [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io): deploy the `backend/` folder as a **Web Service**. Set start command `node server.js` (or `npm start`), set `PORT` from the platform (Render sets `PORT` automatically). The API must stay **always on** for uploads to work; free tiers may sleep until the first request.

### Render: install `qpdf` (Unlock PDF)

The **Unlock PDF** route shells out to **`qpdf`**. Render’s default Node image does **not** include it, so you must install it at build time or use Docker.

**Recommended — Docker (repo root)** — fixes “qpdf not installed” when the service was connected to the **whole Git repo** (not only `backend/`).

- In Render: open your Web Service → **Settings**.
- **Environment:** **Docker** (not “Node”).
- **Dockerfile path:** `Dockerfile` (file at the **repository root**).
- **Docker build context:** `.` (repo root).
- **Start command:** leave empty (the Dockerfile already runs `node server.js`). Render sets `PORT` automatically.

Or use the repo **`render.yaml`** as a [Blueprint](https://render.com/docs/blueprint-spec).

After deploy, open **`https://<your-service>.onrender.com/health`**. You want **`"unlock": "qpdf"`** or **`"unlock": "ghostscript"`**. If **`"unlock": "none"`**, neither tool is available.

**Render free (native Node, no Docker):** you do **not** need `apt-get` in the build. Use **Build Command:** `npm install` (or `bash render-build.sh`, which skips apt without sudo). Ghostscript is included on Render’s **runtime**; unlock uses it when `qpdf` is absent.

**Optional env:** `QPDF_BIN` — absolute path to the `qpdf` binary if it is not on `PATH`.

**Alternative — Docker (`backend/` only)**

- **Dockerfile path:** `backend/Dockerfile`  
- **Docker build context:** `backend`

**Alternative — native Node build**

- **Root directory:** `backend`
- **Build command:** `bash render-build.sh` (installs `qpdf` via `apt-get`, then `npm install`)
- **Start command:** `npm start`

On every deploy, check logs for **`[qpdf] OK —`** (full path + version). If you see **`[qpdf] NOT FOUND`**, Unlock PDF will return **503** until `qpdf` is installed correctly.

Local Docker check (repo root):

```bash
docker build -t edit-pdf-api . && docker run --rm -p 3001:3001 -e PORT=3001 edit-pdf-api
```

Then visit `http://localhost:3001/health`.
2. **Frontend** on [Vercel](https://vercel.com) or [Netlify](https://netlify.com): connect the GitHub repo, root `frontend/`, build `npm run build`, output `dist`. Add an environment variable **`VITE_API_BASE_URL`** = your API’s public URL, e.g. `https://edit-pdf-api.onrender.com` (no trailing slash). Redeploy after the API URL is live.

Locally, leave `VITE_API_BASE_URL` unset; Vite’s dev proxy still sends `/upload`, `/edit`, etc. to port 3001.

**One machine instead:** a small VPS (DigitalOcean, Linode, etc.) running Node + nginx: serve `frontend/dist` as static files and **reverse-proxy** `/upload`, `/edit`, `/download`, `/pdf` to Express on an internal port so everything is one origin (then you do not need `VITE_API_BASE_URL`).

## Project layout

- `frontend/` — Vite React app
- `backend/` — Express server, `routes/`, `services/applyEdits.js`, `utils/sessionCleanup.js`
