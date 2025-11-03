FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Ensure devDependencies (like typescript) are installed during build even if production env is set
ENV NPM_CONFIG_PRODUCTION=false
RUN npm install --include=dev
COPY . .
# Optionally pass VITE_API_BASE_URL at build time
# e.g., docker build --build-arg VITE_API_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# Build using local binaries (no npx/network)
RUN ./node_modules/.bin/tsc -b \
  && ./node_modules/.bin/vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80


