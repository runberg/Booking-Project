FROM node:20-alpine AS build
WORKDIR /app
# Copy only package.json to avoid lockfile incompatibilities across environments
COPY package.json ./
# Ensure all dependencies (including dev) are installed reliably
ENV NPM_CONFIG_PRODUCTION=false
ENV npm_config_production=false
RUN npm install --no-audit --no-fund
COPY . .
# Optionally pass VITE_API_BASE_URL at build time
# e.g., docker build --build-arg VITE_API_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# Build (node_modules/.bin is on PATH when using npm scripts, but we call directly too)
RUN ./node_modules/.bin/vite build || (echo "Vite not found, installing locally..." && npm install vite @vitejs/plugin-react --no-audit --no-fund && ./node_modules/.bin/vite build)

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-entrypoint.sh /usr/local/bin/nginx-entrypoint.sh
RUN chmod +x /usr/local/bin/nginx-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/nginx-entrypoint.sh"]
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


