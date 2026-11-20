# syntax=docker/dockerfile:1
# Imatge de Nginx amb la web d'administració compilada (TG-176, ADR-0030). Context de build:
# l'arrel del monorepo (vegeu deploy/compose.yaml). La VM no necessita Node: es compila aquí.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
# Només les dependències de l'admin (res de l'app mòbil ni de l'API).
RUN npm ci --workspace apps/admin --include-workspace-root=false --ignore-scripts

# Valors públics: van al JavaScript del navegador. Mai la clau service_role.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN if [ -z "$VITE_SUPABASE_URL" ]; then echo "Falta VITE_SUPABASE_URL (SUPABASE_URL al .env)" >&2; exit 1; fi; \
    if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then echo "Falta VITE_SUPABASE_ANON_KEY (SUPABASE_ANON_KEY al .env)" >&2; exit 1; fi

# Fitxer a fitxer: un apps/admin/.env.local del context no ha d'entrar al build.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/admin/index.html apps/admin/vite.config.ts apps/admin/tsconfig.json apps/admin/
COPY apps/admin/src apps/admin/src
# Els ARG ja són a l'entorn del RUN, i Vite els prefereix a qualsevol fitxer .env.
RUN npm run build --workspace apps/admin

FROM nginx:1.28-alpine
COPY --from=build /app/apps/admin/dist /usr/share/nginx/admin
