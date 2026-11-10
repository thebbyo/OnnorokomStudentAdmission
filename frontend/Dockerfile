FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# docker compose --profile tests run --rm --build frontend-tests
FROM deps AS test
COPY . .
CMD ["npx", "vitest", "run"]

FROM deps AS build
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.d/40-config.sh /docker-entrypoint.d/40-config.sh
# Normalise permissions: source checkouts on some filesystems arrive as 0700, which nginx can't serve.
RUN chmod +x /docker-entrypoint.d/40-config.sh && chmod -R a+rX /usr/share/nginx/html
ENV API_BASE_URL=http://localhost:8080
EXPOSE 80
