# Deployment

## Database persistence

The SQLite file must live under `/data` inside the container to persist across restarts; do not point `DATABASE_URL` elsewhere.
