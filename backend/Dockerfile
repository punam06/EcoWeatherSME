FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript files
RUN npm run build

# Expose backend port
EXPOSE 5001

# Start the compiled production server
CMD ["npm", "start"]
