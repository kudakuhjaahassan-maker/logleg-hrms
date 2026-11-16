FROM node:22-alpine

WORKDIR /app

# Install backend dependencies and generate Prisma Client
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY prisma ./prisma
RUN npx prisma generate

# Build the API
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Build the frontend (served by the API in production)
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci --include=dev
COPY frontend ./frontend
RUN npm --prefix frontend run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Apply additive schema changes (geofence radius, shift times, overtime columns)
# before serving, so a fresh deploy never runs against an outdated database.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/server.js"]
