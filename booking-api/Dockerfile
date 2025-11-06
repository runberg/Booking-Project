FROM node:20-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_PRODUCTION=false
ENV npm_config_production=false
# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY . .
# Build using npm script (uses Nest CLI with proper path resolution)
RUN npm run build && ls -la dist/ && ls -la dist/main* || (echo "Build failed or main file not found!" && exit 1)

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
# Copy package files from deps stage (where package-lock.json was validated)
COPY --from=deps /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
VOLUME ["/data"]
ENV DB_PATH=/data/booking.db
EXPOSE 3000
CMD ["node", "dist/main"]


