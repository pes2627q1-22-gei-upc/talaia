# syntax=docker/dockerfile:1
# Imatge del worker (TG-71). Context de build: l'arrel del monorepo (vegeu deploy/compose.yaml).
# Procés llarg que recalcula l'índex cada hora amb node-cron (TG-99, ADR-0024). tsup inclou
# @talaia/db i @talaia/shared dins de dist/main.js, com a l'API.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/worker/package.json services/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN npm ci --workspace services/worker --include-workspace-root=false --ignore-scripts

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY services/worker services/worker
RUN npm run build --workspace services/worker

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/services/worker/package.json services/worker/
COPY --from=deps /app/packages/shared/package.json packages/shared/
COPY --from=deps /app/packages/db/package.json packages/db/
RUN npm ci --workspace services/worker --include-workspace-root=false --ignore-scripts --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# npm deixa algunes dependències dins del workspace (p. ex. zod a services/worker/node_modules).
COPY --from=prod-deps /app ./
COPY --from=build /app/services/worker/dist services/worker/dist
USER node
CMD ["node", "services/worker/dist/main.js"]
