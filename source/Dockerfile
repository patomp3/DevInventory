# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# standalone build + ไฟล์ที่ migration ต้องใช้
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules/pg ./node_modules/pg
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
RUN mkdir -p /data/files && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
