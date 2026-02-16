# Use Node with FFmpeg
FROM node:20-slim

# Install FFmpeg and fonts
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app files
COPY . .

# Create directories
RUN mkdir -p uploads/reactions uploads/demos output

# Expose port
EXPOSE 3456

# Start
CMD ["node", "server.js"]
