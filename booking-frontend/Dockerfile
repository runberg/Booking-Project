FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Ensure all dependencies (including dev) are installed reliably
ENV NPM_CONFIG_PRODUCTION=false
ENV npm_config_production=false
RUN npm install --no-audit --no-fund
COPY . .
# Optionally pass VITE_API_BASE_URL at build time
# e.g., docker build --build-arg VITE_API_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# Build using direct path to vite to avoid PATH issues
RUN ./node_modules/.bin/vite build || (echo "Vite not found, checking installation..." && ls -la node_modules/.bin/ | head -20 && npm ls vite && exit 1)

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80


