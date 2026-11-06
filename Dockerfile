# syntax=docker/dockerfile:1
# BarrioShop — production-style container (frontend + backend in one process,
# mirroring how Vercel runs the same "single project with functions", §29).
# Supabase (Auth/Postgres/Storage) stays a hosted service; it is NOT a
# container here on purpose.

# ---- deps: install with lockfile ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# only prod deps for the runner; dev deps needed for build are installed later
RUN npm ci

# ---- build ----
FROM node:26-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time (public by
# design, same as on Vercel). Pass real values as build args when building
# against your Supabase project; empty defaults keep CI/smoke builds working.
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- run ----
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
