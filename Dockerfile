# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: Runtime image (Python + nginx + supervisor) ─────────────────────
FROM python:3.11-slim

# Install nginx and supervisord
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy built React app to nginx webroot
COPY --from=frontend-build /build/dist /var/www/html

# nginx config (replaces default site)
COPY nginx.conf /etc/nginx/sites-available/default

# supervisord config (manages nginx + uvicorn processes)
COPY supervisord.conf /etc/supervisor/conf.d/app.conf

# Ensure the default symlink points to our config
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

EXPOSE 80

# supervisord runs both nginx and uvicorn
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]
