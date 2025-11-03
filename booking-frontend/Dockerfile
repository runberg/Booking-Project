FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Ensure devDependencies are installed; explicitly disable npm production mode
ENV NPM_CONFIG_PRODUCTION=false
ENV npm_config_production=false
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
# Optionally pass VITE_API_BASE_URL at build time
# e.g., docker build --build-arg VITE_API_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# Build using npm scripts (adds node_modules/.bin to PATH)
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80


