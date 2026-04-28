FROM node:20-alpine AS deps
# libc6-compat diperlukan untuk beberapa native addons di Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies dengan CI mode (reproducible, no package updates)
COPY package.json package-lock.json ./
RUN npm ci

# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js production bundle
# NEXT_TELEMETRY_DISABLED mematikan telemetri Next.js ke Vercel (tidak relevan, tapi best practice)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ──────────────────────────────────────────────────────────────
# Production runner — jalankan custom server.js monolith
# (bukan next start, karena server.js yang meng-orchestrate Express + Socket.io + Aedes)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Port 5151 sesuai nginx upstream: "upstream ettawa { server 127.0.0.1:5151; }"
ENV PORT=5151

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Salin artefak build
COPY --from=builder /app/public       ./public
COPY --from=builder /app/.next        ./.next
# Salin semua source (diperlukan oleh custom server.js monolith):
# server.js, lib/, context/, components/, app/, next.config.mjs, dll
COPY --from=builder --chown=nextjs:nodejs /app/server.js      ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/lib            ./lib
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/package.json   ./package.json
# node_modules production hanya — sudah di-install di stage deps
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules   ./node_modules

USER nextjs

EXPOSE 5151

# Jalankan custom server.js — ini yang mengatur Next.js + Express + Socket.io + Aedes MQTT
CMD ["node", "server.js"]
