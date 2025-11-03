FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Ensure devDependencies are installed using supported flag
RUN npm ci --omit=dev=false --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Compile using local TypeScript (no CLI/network lookup)
RUN ./node_modules/.bin/tsc -p tsconfig.build.json

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev
VOLUME ["/data"]
ENV DB_PATH=/data/booking.db
EXPOSE 3000
CMD ["node", "dist/main.js"]


