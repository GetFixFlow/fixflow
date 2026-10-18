# The front door of a FixFlow install: nginx serving the web app, and passing /api and /cable on to the Rails container.

# Stage 1: build the web app
FROM node:20.20.2-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
# The app is served from the same address as the API (nginx.conf passes /api on), so it asks for relative paths.
# Set here, not read from an .env file: those are not in a fresh clone, and the image must not depend on them.
ENV VITE_API_URL=/api/v1 \
    VITE_APP_ENV=production
RUN npm run build

# Stage 2: serve it
FROM nginx:1.31.7-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/fixflow-security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
