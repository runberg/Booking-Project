FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Ensure devDependencies are installed; explicitly disable production for npm
RUN npm config set production false && npm ci --no-audit --no-fund
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


