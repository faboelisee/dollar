FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 cashflow

COPY --from=builder --chown=cashflow:nodejs /app/dist ./dist
COPY --from=builder --chown=cashflow:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=cashflow:nodejs /app/prisma ./prisma

USER cashflow

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
