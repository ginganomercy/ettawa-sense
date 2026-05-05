FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application code
COPY src/ ./src/

# Expose backend port
EXPOSE 3001

# Run the app
CMD ["npm", "start"]
