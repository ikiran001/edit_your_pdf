# Production API image with qpdf for POST /unlock-pdf (Render, Fly.io, etc.)
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends qpdf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Noto TTFs for Unicode / Devanagari in applyEdits (gitignored locally; required in prod image).
RUN npm run fonts:noto

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
