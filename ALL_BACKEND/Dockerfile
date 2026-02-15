# Dockerfile for ALL_BACKEND Node/Express services
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including dev dependencies for prisma)
RUN npm ci

# Copy Prisma schema first
COPY infrastructure/prisma/ ./infrastructure/prisma/

# Generate Prisma client
RUN npx prisma generate --schema=infrastructure/prisma/schema.prisma

# Copy all necessary files
COPY shared/ ./shared/
COPY services/ ./services/
COPY scripts/ ./scripts/
COPY main.js ./

# Expose port
EXPOSE 5050

# Start server
CMD ["node", "main.js"]
