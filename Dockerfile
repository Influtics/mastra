# Stage 1: install + build
FROM node:22.13-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Stage 2: runtime
FROM node:22.13-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S mastra && adduser -S mastra -G mastra
COPY --from=builder /app/.mastra/output ./.mastra/output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# src/ is required at runtime because scripts/seed-db.ts imports from
# '../src/mastra/index.ts'. The build artifact does not contain source files.
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/
# /data is the Coolify persistent volume mount — the libSQL file lives here.
# The entrypoint bootstraps the schema (parent dir already exists).
RUN mkdir -p /data && chown -R mastra:mastra /data
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R mastra:mastra /app
USER mastra
EXPOSE 4111
ENTRYPOINT ["docker-entrypoint.sh"]
