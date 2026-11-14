FROM node:20-slim AS web
WORKDIR /build
COPY apps/web/package.json ./package.json
COPY apps/web/pnpm-lock.yaml ./pnpm-lock.yaml
RUN npm install --no-audit --no-fund
COPY apps/web ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY services/api/requirements.txt ./services/api/requirements.txt
RUN pip install --no-cache-dir -r services/api/requirements.txt
COPY services/api ./services/api
COPY data ./data
COPY apps/web ./apps/web
COPY --from=web /build/dist ./apps/web/dist
RUN chown -R 1000:1000 /app
USER 1000:1000
EXPOSE 8000
CMD ["sh", "-c", "cd services/api && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
