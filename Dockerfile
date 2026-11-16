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

# Schema sync runs in a bounded, best-effort entrypoint (scripts/start.sh): it is
# time-limited, warns on failure, and can never keep the Node server from starting.
# No raw SQL is executed during startup; one-time data fixes run inside the app
# after listen and swallow their own errors.
COPY scripts ./scripts
RUN chmod +x ./scripts/start.sh
CMD ["./scripts/start.sh"]
