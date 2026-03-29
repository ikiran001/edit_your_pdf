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
| `POST` | `/edit` | JSON `{ sessionId, edits, applyTextSwap?, nativeTextEdits? }` → writes `edited.pdf`. Optional `nativeTextEdits[]` carries Word-style replacements (PDF coords + font size + string) from the **Edit text** tool; see `mergeEdits.js` + `nativeText` in `applyEdits.js`. If `applyTextSwap` is true, default phrase rules run in `applyTextReplacements.js`. |
| `GET` | `/download?sessionId=` | download edited PDF (or original if never edited) |

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

Local build matching Pages:  
`cd frontend && VITE_BASE_PATH=/edit_your_pdf/ VITE_API_BASE_URL=https://your-api.example.com npm run build`

### Google Analytics (optional)

The app supports **GA4** via [gtag.js](https://developers.google.com/tag-platform/gtagjs). The Measurement ID is baked in at **build** time.

1. In [Google Analytics](https://analytics.google.com/), create a **GA4** property and copy the **Measurement ID** (format `G-XXXXXXXXXX`).
2. **GitHub Pages:** add repository secret **`VITE_GA_MEASUREMENT_ID`** with that value, then re-run **Deploy frontend to GitHub Pages**.
3. **Local / Vercel / Netlify:** set the same name in environment variables when you run `npm run build`.

If the variable is unset, no analytics script runs. Virtual page paths: `/` (landing) and `/edit` (after upload).

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
2. **Frontend** on [Vercel](https://vercel.com) or [Netlify](https://netlify.com): connect the GitHub repo, root `frontend/`, build `npm run build`, output `dist`. Add an environment variable **`VITE_API_BASE_URL`** = your API’s public URL, e.g. `https://edit-pdf-api.onrender.com` (no trailing slash). Redeploy after the API URL is live.

Locally, leave `VITE_API_BASE_URL` unset; Vite’s dev proxy still sends `/upload`, `/edit`, etc. to port 3001.

**One machine instead:** a small VPS (DigitalOcean, Linode, etc.) running Node + nginx: serve `frontend/dist` as static files and **reverse-proxy** `/upload`, `/edit`, `/download`, `/pdf` to Express on an internal port so everything is one origin (then you do not need `VITE_API_BASE_URL`).

## Project layout

- `frontend/` — Vite React app
- `backend/` — Express server, `routes/`, `services/applyEdits.js`, `utils/sessionCleanup.js`
