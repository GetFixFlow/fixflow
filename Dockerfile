ARG RUBY_VERSION=3.3.0
FROM ruby:${RUBY_VERSION}-slim AS base

WORKDIR /rails

RUN apt-get update -qq && \
  apt-get install --no-install-recommends -y \
  build-essential \
  git \
  libpq-dev \
  libvips \
  pkg-config \
  curl && \
  rm -rf /var/lib/apt/lists/*

ENV RAILS_ENV=production
ENV BUNDLE_DEPLOYMENT=1
ENV BUNDLE_PATH=/usr/local/bundle
ENV BUNDLE_WITHOUT=development:test

FROM base AS build

COPY Gemfile Gemfile.lock ./
RUN bundle install && \
  rm -rf "${BUNDLE_PATH}/ruby/*/cache" "${BUNDLE_PATH}/ruby/*/bundler/gems/*/.git"

COPY . .

FROM base

COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

RUN groupadd --system --gid 1000 rails && \
  useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
  chown -R rails:rails db log storage tmp

USER 1000:1000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
