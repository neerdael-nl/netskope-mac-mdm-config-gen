# Use a more recent Node runtime as the parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json files first for better caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install && \
    cd client && npm install && \
    cd ../server && npm install

# Copy the rest of the application code
COPY . .

# Build the React app for production
RUN cd client && npm run build

# Set permissions for the node user
RUN chown -R node:node /usr/src/app

# Switch to the node user
USER node

# Make port 3001 available
EXPOSE 3001

# Define environment variable
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/server.js"]