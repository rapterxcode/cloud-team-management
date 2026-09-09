FROM node:22-slim AS webbuild
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM caddy:2
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=webbuild /web/dist /srv
