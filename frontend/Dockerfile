FROM node:18 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

RUN rm -rf src node_modules

FROM node:18-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/package.json package.json

RUN npm install --omit=dev

EXPOSE 3000

CMD ["npm", "start"]