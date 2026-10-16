# syntax=docker/dockerfile:1
# Imatge de l'API (TG-71). Context de build: l'arrel del monorepo (vegeu deploy/compose.yaml).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/api/package.json services/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
# Només les dependències de l'API i dels paquets que consumeix (res de l'app mòbil).
RUN npm ci --workspace services/api --include-workspace-root=false --ignore-scripts

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY services/api services/api
RUN npm run build --workspace services/api

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/services/api/package.json services/api/
COPY --from=deps /app/packages/shared/package.json packages/shared/
COPY --from=deps /app/packages/db/package.json packages/db/
RUN npm ci --workspace services/api --include-workspace-root=false --ignore-scripts --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production API_PORT=3000
WORKDIR /app
# npm deixa algunes dependències dins del workspace (p. ex. zod a services/api/node_modules).
COPY --from=prod-deps /app ./
COPY --from=build /app/services/api/dist services/api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT}/api/v1/health" > /dev/null || exit 1
CMD ["node", "services/api/dist/server.js"]
