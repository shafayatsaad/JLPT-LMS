FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV JLPT_NEXT_DIST_DIR=.next-docker
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_AUTH_ENABLE_PHONE=true
ARG NEXT_PUBLIC_DEMO_LAN_ENABLED=false
ARG LOCAL_DEMO_SUPABASE_PROXY=false
ARG SUPABASE_PROXY_TARGET=http://host.docker.internal:54321
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_AUTH_ENABLE_PHONE=$NEXT_PUBLIC_AUTH_ENABLE_PHONE
ENV NEXT_PUBLIC_DEMO_LAN_ENABLED=$NEXT_PUBLIC_DEMO_LAN_ENABLED
ENV LOCAL_DEMO_SUPABASE_PROXY=$LOCAL_DEMO_SUPABASE_PROXY
ENV SUPABASE_PROXY_TARGET=$SUPABASE_PROXY_TARGET
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV JLPT_NEXT_DIST_DIR=.next-docker
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next-docker ./.next-docker
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
