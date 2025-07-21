# Dockerfile

# 1. Builder
FROM node:18-alpine AS builder

# Accept the API URL as a build argument
ARG NEXT_PUBLIC_API_URL
# Set it as an environment variable
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

# The build will now have access to the env var
RUN npm run build

# 2. Runner
FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
