#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups/db}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-ai_dashboard}"
POSTGRES_USER="${POSTGRES_USER:-ai_dashboard}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*"
}

run_backup() {
  mkdir -p "$BACKUP_DIR"

  timestamp="$(date '+%Y%m%d-%H%M%S')"
  backup_path="$BACKUP_DIR/${POSTGRES_DB}_${timestamp}.dump"
  checksum_path="$backup_path.sha256"

  log "Starting PostgreSQL backup: $backup_path"

  if pg_dump \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --file="$backup_path"; then
    sha256sum "$backup_path" > "$checksum_path"
    log "Backup completed: $backup_path"
  else
    rm -f "$backup_path" "$checksum_path"
    log "Backup failed"
    return 1
  fi

  if [ "$BACKUP_RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
    find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime +"$BACKUP_RETENTION_DAYS" -delete
    log "Retention applied: ${BACKUP_RETENTION_DAYS} days"
  fi
}

if [ "${1:-}" = "once" ]; then
  run_backup
  exit $?
fi

while true; do
  run_backup || true
  log "Next backup in ${BACKUP_INTERVAL_SECONDS} seconds"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
