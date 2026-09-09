#!/usr/bin/env bash
# Nightly 02:00 backup: pg_dump + attachments tar, 14-day retention.
set -euo pipefail

while true; do
  now=$(date +%s)
  today_2am=$(date -d '02:00' +%s)
  if [ "$now" -lt "$today_2am" ]; then
    target=$today_2am
  else
    target=$(date -d 'tomorrow 02:00' +%s)
  fi
  sleep $((target - now))

  stamp=$(date +%F)
  dir="/backups/$stamp"
  mkdir -p "$dir"
  echo "[backup] $stamp starting"
  pg_dump -Fc -f "$dir/ctm.dump"
  tar -czf "$dir/attachments.tar.gz" -C /attachments .
  echo "[backup] $stamp done: $(du -sh "$dir" | cut -f1)"

  # Retention: remove dated dirs older than 14 days
  find /backups -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf {} +
done
