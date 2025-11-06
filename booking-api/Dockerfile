FROM node:20-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_PRODUCTION=false
ENV npm_config_production=false
# Copy only package.json to avoid lockfile incompatibilities
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build using npm script (uses Nest CLI with proper path resolution)
RUN npm run build && ls -la dist/ && ls -la dist/main* || (echo "Build failed or main file not found!" && exit 1)

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
# Copy package files for production install
COPY package.json package-lock.json ./
# Use npm install instead of npm ci to be more forgiving with lockfile mismatches
RUN npm install --omit=dev --no-audit --no-fund
VOLUME ["/data"]
ENV DB_PATH=/data/booking.db
EXPOSE 3000
CMD ["node", "dist/main"]


