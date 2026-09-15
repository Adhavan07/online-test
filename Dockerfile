# ==========================================
# STAGE 1: Build Dependencies and Bundles
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install native dependencies required for build tools and Prisma
RUN apk add --no-cache libc6-compat openssl python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=server/src/prisma/schema.prisma

# Build frontend and compile backend TypeScript
RUN npm run build:client
RUN npm run build:server

# ==========================================
# STAGE 2: Lightweight Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies (OpenSSL for Prisma, wget for healthcheck, python3 for multi-language sandboxed runner)
RUN apk add --no-cache openssl wget dumb-init python3

ENV NODE_ENV=production
ENV PORT=5000

# Copy package descriptors and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled frontend and backend assets from builder
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/prisma ./server/src/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create directory structure for uploads
RUN mkdir -p uploads/resumes uploads/proctoring uploads/badges uploads/temp

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy --schema=server/src/prisma/schema.prisma && node server/dist/index.js"]
