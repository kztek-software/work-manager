#!/usr/bin/env bash
# ==============================================================================
# Script: backup-postgres.sh
# Mo ta : Tu dong sao luu CSDL PostgreSQL dinh ky (cronjob / container / manual)
# Du an : KZTEK Work Management (FlowBoard) — Phase G0 Gate 1 (DevOps Hardening)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 1. Nap cau hinh tu .env neu co
if [ -f "${ROOT_DIR}/.env" ]; then
    # shellcheck disable=SC1091
    export $(grep -v '^#' "${ROOT_DIR}/.env" | xargs -d '\n') || true
fi

# 2. Thiet lap bien moi truong mac dinh
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"

DB_NAME="${POSTGRES_DB:-WorkingManager}"
DB_USER="${POSTGRES_USER:-kztek}"
DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_PASSWORD="${POSTGRES_PASSWORD:-kztek}"
CONTAINER_NAME="${DB_CONTAINER_NAME:-kztek-work-management-db}"

# Parse tu DATABASE_URL neu co
if [ -n "${DATABASE_URL:-}" ]; then
    # Format: postgresql://user:password@host:port/dbname?params
    PROTO="$(echo "${DATABASE_URL}" | grep :// | sed -e's,^\(.*://\).*,\1,g')"
    URL_NO_PROTO="${DATABASE_URL#$PROTO}"
    USER_PASS="$(echo "${URL_NO_PROTO}" | grep @ | cut -d@ -f1 || true)"
    HOST_PORT_DB="${URL_NO_PROTO#$USER_PASS@}"
    
    if [ -n "${USER_PASS}" ]; then
        DB_USER="$(echo "${USER_PASS}" | cut -d: -f1)"
        DB_PASSWORD="$(echo "${USER_PASS}" | cut -d: -f2)"
    fi
    
    HOST_PORT="$(echo "${HOST_PORT_DB}" | cut -d/ -f1)"
    DB_HOST="$(echo "${HOST_PORT}" | cut -d: -f1)"
    if echo "${HOST_PORT}" | grep -q :; then
        DB_PORT="$(echo "${HOST_PORT}" | cut -d: -f2)"
    fi
    
    DB_NAME_QUERY="$(echo "${HOST_PORT_DB}" | cut -d/ -f2)"
    DB_NAME="$(echo "${DB_NAME_QUERY}" | cut -d\? -f1)"
fi

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
echo "=============================================================================="
echo "  KZTEK WORK MANAGEMENT — POSTGRESQL BACKUP"
echo "=============================================================================="
echo "Thoi gian  : $(date '+%Y-%m-%d %H:%M:%S')"
echo "Database   : ${DB_NAME}"
echo "User       : ${DB_USER}"
echo "Host       : ${DB_HOST}:${DB_PORT}"
echo "Thu muc    : ${BACKUP_DIR}"
echo "File xuat  : $(basename "${BACKUP_FILE}")"
echo "Retention  : Giu lai ${RETENTION_DAYS} ngay"
echo "------------------------------------------------------------------------------"

# 3. Kiem tra phuong thuc sao luu (Docker container hoac CLI cuc bo)
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[INFO] Phat hien container ${CONTAINER_NAME} dang hoat dong. Thuc thi qua docker exec..."
    docker exec -e PGPASSWORD="${DB_PASSWORD}" "${CONTAINER_NAME}" \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges \
        | gzip -9 > "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
    echo "[INFO] Su dung pg_dump cuc bo..."
    export PGPASSWORD="${DB_PASSWORD}"
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        --clean --if-exists --no-owner --no-privileges \
        | gzip -9 > "${BACKUP_FILE}"
    unset PGPASSWORD
else
    echo "[ERROR] Khong tim thay lenh 'pg_dump' va container '${CONTAINER_NAME}' khong chay!" >&2
    exit 1
fi

# 4. Kiem tra ket qua file dump
if [ -s "${BACKUP_FILE}" ]; then
    FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
    echo "[SUCCESS] Sao luu CSDL thanh cong! Dung luong: ${FILE_SIZE}"
else
    echo "[ERROR] File sao luu tao ra bi rong (0 bytes)!" >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# 5. Don dep file sao luu cu hon ${RETENTION_DAYS} ngay
echo "[INFO] Kiem tra va don dep ban sao luu cu hon ${RETENTION_DAYS} ngay..."
find "${BACKUP_DIR}" -type f -name "backup_${DB_NAME}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
echo "[INFO] Hoan tat chu trinh sao luu an toan."
echo "=============================================================================="
