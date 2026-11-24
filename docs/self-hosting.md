# Self-hosting Open-EDU

Build the static application and run the included dependency-free Node server:

```sh
npm ci
npm run build
PORT=3000 npm start
```

The server listens on `0.0.0.0`, serves `build/`, falls back to the SPA entry point, and sends `/api/mongo` to the existing MongoDB/Firebase API handler. It uses the same server-only environment variables as the Vercel function: `MONGODB_URI`, `MONGODB_DATABASE`, `FIREBASE_SERVICE_ACCOUNT_JSON`, and `ALLOWED_ORIGINS`.

For PM2:

```sh
PORT=3000 pm2 start npm --name open-edu -- start
pm2 save
```

When serving the application below a reverse-proxy path such as `/deployments/3/`, build with `PUBLIC_BASE_PATH=/deployments/3`. The Node server accepts either a preserved prefix or an `X-Forwarded-Prefix: /deployments/3` header when the proxy strips the prefix. Set `PUBLIC_API_BASE_URL` only when the API intentionally lives on another origin or path; otherwise browser requests stay same-origin.

`ALLOWED_ORIGINS` remains a comma-separated exact allowlist. It is applied by `/api/mongo` to authenticated requests and `OPTIONS` preflight responses; no wildcard origin is used.

## Scheduled reminders

Vercel continues to invoke `/api/reminders` from its existing hourly cron configuration. In a self-hosted deployment, schedule an hourly POST to the Node server’s `/api/reminders` endpoint using a system cron, Kubernetes CronJob, or another scheduler. Supply `Authorization: Bearer <CRON_SECRET>` and configure the same `CRON_SECRET` in the server environment. The reminder endpoint reuses the existing Brevo and MongoDB implementation; it is intended for server-to-server scheduling, not browser access.
