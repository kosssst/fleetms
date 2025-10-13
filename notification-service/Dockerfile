# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# спочатку тільки маніфести щоб кешувався npm ci
COPY package.json package-lock.json* ./
RUN npm ci

# далі код
COPY tsconfig.json ./
COPY src ./src

# компіляція TS -> JS
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

# ставимо лише прод-залежності
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# копіюємо зібраний код
COPY --from=build /app/dist ./dist

# запуск
CMD ["node", "dist/index.js"]
