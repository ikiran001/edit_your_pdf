# Deploy from repository ROOT on Render (Docker context = .)
# Dashboard: Dockerfile Path = Dockerfile, Docker Context = .
FROM node:22-bookworm-slim

# qpdf: unlock + compress · ghostscript: stronger compress tier · libreoffice: DOCX↔PDF
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    qpdf \
    ghostscript \
    libreoffice-writer \
    ocrmypdf \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

RUN npm run fonts:noto

ENV NODE_ENV=production
ENV SOFFICE_PATH=/usr/bin/soffice
ENV OCR_LANGS=eng+hin
EXPOSE 3001

CMD ["node", "server.js"]
