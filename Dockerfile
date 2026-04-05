# Deploy from repository ROOT on Render (Docker context = .)
# Dashboard: Dockerfile Path = Dockerfile, Docker Context = .
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends qpdf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

RUN npm run fonts:noto

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
