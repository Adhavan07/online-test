# TechScreen Pro — Operational Runbook & Deployment Guide

## 1. Prerequisites

Before running the platform, ensure the following tools are installed:
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Docker & Docker Compose**: v2.20+
- **Python**: v3.10+ (for multi-language sandboxed code execution)
- **PostgreSQL**: 16 (or run via Docker Compose)
- **Redis**: 7 (or run via Docker Compose)

---

## 2. Environment Configuration

1. Copy the example environment template:
   ```bash
   cp .env.example .env
   ```
2. Verify or update required variables in `.env`:
   ```ini
   NODE_ENV=development
   PORT=5000
   DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/techscreen_pro?schema=public
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=techscreen-enterprise-secret-change-in-prod-2026-secure
   JWT_EXPIRES_IN=8h
   STORAGE_DRIVER=local
   UPLOAD_DIR=./uploads
   ```

> [!WARNING]
> In production environments (`NODE_ENV=production`), `JWT_SECRET` must be at least 32 characters long and cannot be a weak default. The application will terminate on startup if an insecure secret is detected.

---

## 3. Database Initialization & Seeding

1. **Start database containers (if running PostgreSQL and Redis locally via Docker)**:
   ```bash
   npm run docker:up
   ```
2. **Synchronize Prisma schema with the database**:
   ```bash
   npm run db:push
   ```
3. **Seed demo data (recruiter accounts, assessment templates, sample candidates)**:
   ```bash
   npm run db:seed
   ```

### Default Seeded Credentials:
- **Admin**: `admin@techscreen.com` / `Admin@123456`
- **Recruiter**: `recruiter@acme.com` / `Recruiter@123456`
- **Demo Candidate Assessment**: `http://localhost:3000/assessment/demo-test-token-priya-123456`

---

## 4. Running the Application Locally

### Development Mode (Concurrent Server & Vite Client with HMR):
```bash
npm run dev
```
- Frontend UI: `http://localhost:3000` (or `http://localhost:5173`)
- Backend API: `http://localhost:5000/api`
- Health Check: `http://localhost:5000/api/health`

### Individual Service Commands:
```bash
npm run dev:server   # Watch server TypeScript changes via tsx
npm run dev:client   # Run Vite client development server
npm run db:studio    # Open Prisma Studio web inspector
```

---

## 5. Running the Automated Test Suite

TechScreen Pro contains a comprehensive Vitest test suite covering all security, isolation, and functional phases:

```bash
# Run all test suites
npm test

# Run a specific test suite
npx vitest run server/src/tests/proctoring.test.ts
npx vitest run server/src/tests/codeExecution.test.ts
npx vitest run server/src/tests/e2eWorkflow.test.ts
```

### Complete Test Suites:
| Test Suite | Description |
|---|---|
| `auth.test.ts` | RBAC enforcement, client role elevation prevention, password hashing |
| `tenant.test.ts` | Company data isolation and cross-tenant Anti-IDOR |
| `otp.test.ts` | Hashed OTP storage, brute-force lockout, single-use invalidation |
| `answerSecurity.test.ts` | Answer sanitization, server-side grading, hidden test case protection |
| `secrets.test.ts` | Fail-fast secret validation, JWT expiry, environment checks |
| `candidateIsolation.test.ts` | Attempt IDOR isolation, lifecycle state guards |
| `resumeSecurity.test.ts` | Magic-byte validation, path traversal prevention, PDF parsing |
| `timerSecurity.test.ts` | Server-authoritative timer, auto-advance, late submission rejection |
| `proctoring.test.ts` | Proctor event debouncing, rate limiting, real-time risk scoring, snapshot checks |
| `codeExecution.test.ts` | JS/TS/Python sandbox, AST screening, infinite loop timeout, buffer limits |
| `migrationsAndSeed.test.ts` | Schema integrity, foreign keys, password hash formats |
| `securityHeadersAndValidation.test.ts` | Enterprise HTTP headers, input sanitization, login rate limiting |
| `e2eWorkflow.test.ts` | Complete 12-step Recruiter & Candidate lifecycle integration |

---

## 6. Production Build & Docker Deployment

### Building Locally:
```bash
npm run build
```
This builds:
- Backend: Compiled ES2022 JavaScript to `server/dist/`
- Frontend: Optimized production bundle to `client/dist/`

### Deploying via Docker Compose:
```bash
# Build and start all production services in the background
docker compose up -d --build

# Inspect running container health
docker compose ps

# View live service logs
npm run docker:logs
```

---

## 7. Database Backup, Restore & Maintenance

### Creating a PostgreSQL Backup:
```bash
docker exec -t techscreen-postgres pg_dump -U postgres -d techscreen_pro -F c -b -v -f /var/lib/postgresql/data/backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restoring from Backup:
```bash
docker exec -t techscreen-postgres pg_restore -U postgres -d techscreen_pro -v -c /var/lib/postgresql/data/<backup_file>.dump
```

### Clearing Temporary Sandbox Files:
Sandbox files in `/tmp/techscreen_sandbox` are automatically cleaned up after execution. To manually purge stale files:
```bash
rm -rf /tmp/techscreen_sandbox/*
```

---

## 8. Operational Troubleshooting & Diagnostics

### Symptom: `Database connection refused (ECONNREFUSED 5432)`
- Verify the PostgreSQL container is running and healthy: `docker compose ps`
- Check PostgreSQL container logs: `docker compose logs postgres`
- Ensure `DATABASE_URL` matches the running port and credentials.

### Symptom: `JWT Secret validation failed: Weak or default secret in production`
- Set `JWT_SECRET` in `.env` to a cryptographically secure random string with at least 32 characters:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### Symptom: `Code execution times out on all submissions`
- Ensure Python 3 is installed in the runtime environment: `python3 --version`
- Check that `/tmp/techscreen_sandbox` is writable by the running process.

### Symptom: `Webcam snapshot upload rejected (413 Payload Too Large)`
- The system enforces a 2MB binary limit on webcam snapshot buffers. Check that the client frontend does not emit uncompressed raw canvas streams exceeding this threshold.
