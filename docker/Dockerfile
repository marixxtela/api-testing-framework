# syntax=docker/dockerfile:1.7

# Image kept in two variants: alpine for healthcheck via wget and debugging,
# distroless to reduce attack surface in production.

ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
ENV CI=true HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --include=dev


FROM deps AS builder
WORKDIR /app
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate \
    && npm run api:build \
    && npm prune --omit=dev


FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    API_HOST=0.0.0.0 \
    API_PORT=3000 \
    DATABASE_URL=file:/data/dev.db

RUN apk add --no-cache wget tini \
    && addgroup -g 1001 -S app \
    && adduser -u 1001 -S app -G app \
    && mkdir -p /data \
    && chown -R app:app /data

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget --quiet --spider http://127.0.0.1:3000/ready || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/api/server.js"]


FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime-distroless
WORKDIR /app
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3000

COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/prisma ./prisma
COPY --chown=nonroot:nonroot package.json ./

USER nonroot
EXPOSE 3000

CMD ["dist/api/server.js"]
