# ChatLock Deployment & Operational Guide

This document covers containerization, staging/production deployments, and environment configuration management for the ChatLock platform.

---

## 1. Development Deployment (Docker Compose)

For local development, MongoDB and Redis are managed via Docker Compose:

```bash
# Start local containers in background
pnpm docker:up

# View logs
pnpm docker:logs

# Stop containers
pnpm docker:down
```

### Services Started:

- **MongoDB 7.0**: Accessible at `localhost:27017`
  - Root user: `root`
  - Root password: `chatlock_dev_pass`
  - App database: `chatlock`
- **Redis 7.2**: Accessible at `localhost:6379`
  - Password: `chatlock_redis_dev_pass`

---

## 2. Server Production Containerization

The backend server is packaged using a multi-stage Docker build (`infrastructure/docker/Dockerfile.server`):

```bash
# Build the production container image
docker build -t chatlock-server:latest -f infrastructure/docker/Dockerfile.server .

# Run the container with production environment
docker run -d \
  --name chatlock-server \
  -p 5000:5000 \
  --env-file .env.production \
  chatlock-server:latest
```

### Key Security & Optimization Features:

- **Multi-Stage Build**: Keeps the runner image lean by excluding build tools and devDependencies.
- **Non-Root Execution**: Runs under a dedicated `chatlock:nodejs` user with UID/GID 1001.
- **Healthcheck Ready**: Exposes `/health` endpoint for Kubernetes and container load balancers.

---

## 3. Environment Strategy Across Stages

| Category         | Development          | Staging                | Production                      |
| ---------------- | -------------------- | ---------------------- | ------------------------------- |
| `NODE_ENV`       | `development`        | `staging`              | `production`                    |
| `MONGODB_URI`    | `localhost:27017`    | Managed Mongo cluster  | Managed replica set with TLS    |
| `REDIS_URL`      | `localhost:6379`     | Managed Redis instance | Redis cluster with Sentinel/TLS |
| `LOG_LEVEL`      | `debug`              | `info`                 | `warn` / `info`                 |
| `LOG_PRETTY`     | `true`               | `false` (JSON logs)    | `false` (JSON logs)             |
| `HELMET_ENABLED` | `true`               | `true`                 | `true`                          |
| `CORS_ORIGIN`    | `http://localhost:*` | Staging domains        | Production domains only         |

---

## 4. Mobile Client Builds (EAS / Expo)

Expo configuration is dynamically managed in `apps/mobile/app.config.ts`:

- **Development Build**:
  ```bash
  APP_ENV=development eas build --profile development
  ```
- **Staging Build**:
  ```bash
  APP_ENV=staging eas build --profile staging
  ```
- **Production Store Release**:
  ```bash
  APP_ENV=production eas build --profile production
  ```

Only `EXPO_PUBLIC_*` environment variables are injected into client binaries.
