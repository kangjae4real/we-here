# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS source
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm fetch --frozen-lockfile --store-dir /pnpm-store
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm-store

FROM source AS api-build
RUN pnpm --filter api build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm --filter api deploy --prod --legacy --store-dir /pnpm-store /out

FROM source AS web-build
ARG NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=""
ENV NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=$NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
RUN pnpm --filter web build

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=api-build --chown=node:node /out ./
COPY --from=api-build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]

FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=web-build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
