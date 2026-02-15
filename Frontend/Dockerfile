FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
# Note: React environment variables are embedded at build time
# For runtime env vars, we need to use a script or rebuild
CMD ["npm", "start"]
