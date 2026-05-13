# ── Build stage ─────────────────────────────────────────────────────────────
FROM ruby:3.3-alpine AS builder

RUN apk add --no-cache \
      build-base \
      postgresql-dev \
      git \
      tzdata \
      nodejs \
      npm

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without "development test" && \
    bundle install --jobs 4 --retry 3

COPY . .

# Precompile assets (no-op for API-only app, safe to run)
RUN bundle exec rails assets:precompile 2>/dev/null || true

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM ruby:3.3-alpine AS runtime

RUN apk add --no-cache \
      postgresql-client \
      tzdata \
      curl \
      libpq

WORKDIR /app

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /app .

RUN adduser -D -u 1000 fixflow && \
    chown -R fixflow:fixflow /app

USER fixflow

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["bin/docker-entrypoint.sh"]
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
