# Build My AI — self-host image. The backend is zero-dependency (Python stdlib
# only), so there is no `pip install` step and no supply chain to audit: the
# base image plus our source is the entire footprint. One image serves both
# roles (API and static site) via different compose commands.
FROM python:3.12-slim

WORKDIR /app

# Only what runs in production. Tests/docs/figma stay out of the image
# (.dockerignore also trims the build context).
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# SQLite lives on a mounted volume (see docker-compose.yml).
RUN mkdir -p /app/data
ENV BMA_DB=/app/data/events.db \
    BMA_USERS_DB=/app/data/users.db

EXPOSE 8940 8931

# stdlib-only liveness probe (no curl in slim). Checks the API's /v1/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["python3", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8940/v1/health', timeout=3).status==200 else 1)"]

# Default to the API; docker-compose overrides the command for the web service.
CMD ["python3", "backend/api/server.py", "--host", "0.0.0.0", "--port", "8940"]
