FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Ensure devDependencies (like @nestjs/cli) are installed during build
ENV NPM_CONFIG_PRODUCTION=false
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx nest build

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


