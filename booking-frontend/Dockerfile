FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
# Write the server timezone into env.js at startup so the frontend can read
# it synchronously before the app renders — no async fetch needed.
CMD ["sh", "-c", "printf 'window.__SERVER_TZ__=\"%s\";\\n' \"${TZ:-UTC}\" > /usr/share/nginx/html/env.js && nginx -g 'daemon off;'"]
