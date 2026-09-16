# ChatLock — Deployment, CI/CD & Production Infrastructure

This document details the deployment configurations, containerization, cloud hosting, and continuous integration pipelines for **ChatLock**.

---

## 1. Multi-Target Deployment Architecture

```
                                  +-------------------------------------------------------------+
                                  |                     GitHub Repository                       |
                                  +------------------------------+------------------------------+
                                                                 |
                                              [ GitHub Actions CI/CD Pipeline ]
                                                                 |
                        +----------------------------------------+----------------------------------------+
                        |                                        |                                        |
                        v                                        v                                        v
+-----------------------------------------------+ +-----------------------------------------------+ +-----------------------------------------------+
|         Render Web Service (Backend)          | |          Vercel Platform (Web App)            | |            Expo EAS Cloud (Mobile)            |
| - Environment: Node.js 22 + Express 4.21      | | - Environment: Next-gen Static Web Export    | | - Build Profiles: preview (.apk) / prod (.aab)|
| - Health Check: `/health/ready`               | | - Routing: SPA fallback rewrites (`/index`)  | | - Target: Standalone Android APK & Play Store |
| - Host: https://chatlock-server.onrender.com  | | - Host: https://chatlock-web.vercel.app       | | - Output: Signed APK artifacts                |
+-----------------------------------------------+ +-----------------------------------------------+ +-----------------------------------------------+
```

---

## 2. Server Deployment (Render Blueprint)

Configured via Infrastructure-as-Code in `render.yaml`:

```yaml
services:
  - type: web
    name: chatlock-server
    runtime: node
    plan: starter
    region: oregon
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter @chatlock/server build
    startCommand: pnpm --filter @chatlock/server start
    healthCheckPath: /health/ready
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        sync: false
      - key: JWT_ACCESS_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
```

---

## 3. Web App Deployment (Vercel)

Configured in `vercel.json` for static Single-Page Application (SPA) hosting:

```json
{
  "version": 2,
  "buildCommand": "pnpm --filter @chatlock/mobile export:web",
  "outputDirectory": "apps/mobile/dist",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## 4. Mobile App EAS Build Profiles (`eas.json`)

Configured across repository root and `apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      }
    }
  }
}
```

### Build Commands
```bash
# Generate standalone Android APK (preview)
eas build --platform android --profile preview --non-interactive

# Generate production Google Play App Bundle (.aab)
eas build --platform android --profile production --non-interactive
```

---

## 5. Local Docker Development Environment

A local Docker Compose environment is provided in `docker-compose.yml` and `infrastructure/docker`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: chatlock-mongo
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: chatlock

  redis:
    image: redis:7.2-alpine
    container_name: chatlock-redis
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

### Starting Infrastructure
```bash
docker-compose up -d
```

---

## 6. GitHub Actions Automated CI/CD Pipeline

The `.github/workflows/ci.yml` pipeline runs on every push and pull request against `main`:

```
+-------------------------------------------------------------+
|                GitHub Actions Pipeline (Node 22)            |
+------------------------------+------------------------------+
                               |
                               v
                       1. `pnpm install`
                               |
                               v
                        2. `pnpm build`
                               |
                               v
             +-----------------+-----------------+
             |                 |                 |
             v                 v                 v
   3. `format:check`     4. `pnpm lint`   5. `pnpm typecheck`
             |                 |                 |
             +-----------------+-----------------+
                               |
                               v
                  6. `pnpm test` (525+ Tests)
```
