# Derive user workload at query time instead of storing a counter

A user's workload percentage was previously stored as a static integer column on the `users` table. We derive workload dynamically on query (in `GET /users` and Copilot snapshots) from the count of active, incomplete tasks owned by the user (20% per active task, capped at 100%). For an internal workspace team roster, query-time derivation eliminates counter synchronization races and cache drift across task mutations without requiring database triggers or transaction locks.
