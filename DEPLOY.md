# Auto Deploy

Pushing to `main` deploys automatically via GitHub Actions.

## Required GitHub Secrets

**Settings → Secrets and variables → Actions**

| Secret | Example |
|---|---|
| `DEPLOY_HOST` | `note.annaniks.com` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | private SSH key |
| `DEPLOY_PORT` | `22` (optional) |
| `DEPLOY_PATH_FRONT` | `/var/www/notes_app/notes_front` |
| `VITE_APP_API_URL` | `https://note.annaniks.com` |

Use the same `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` as the backend repo.

## Server note

Keep `.env` on the server (or set `VITE_APP_API_URL` secret). Deploy does not overwrite an existing `.env`.

PM2 app name: `notes-frontend` (`ecosystem.config.cjs`).
