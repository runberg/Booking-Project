FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Ensure devDependencies (like typescript) are installed during build even if production env is set
ENV NPM_CONFIG_PRODUCTION=false
RUN npm ci
COPY . .
# Optionally pass VITE_API_BASE_URL at build time
# e.g., docker build --build-arg VITE_API_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# Install dev deps explicitly and invoke tsc/vite via npx to avoid PATH issues
RUN npm ci --include=dev \
  && npx tsc -b \
  && npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80


