FROM python:3.11-slim

# WORKDIR mirrors this repo's own backend/ subfolder (not a flattened /app)
# so that domain/downtime_logic.py's and the import_*.py seed scripts'
# Path(__file__).resolve().parent... based lookups of the sibling data/
# folder resolve identically here and in local/dev runs.
WORKDIR /app/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY data/ /app/data/

RUN mkdir -p /data /watch \
    && groupadd -g 1000 appuser \
    && useradd -u 1000 -g appuser -m -s /bin/sh appuser

COPY backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
