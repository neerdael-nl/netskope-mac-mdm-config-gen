# Use a more recent Node runtime as the parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Create a non-root user and set ownership
RUN mkdir -p /usr/src/app/client /usr/src/app/server && \
    mkdir -p /home/node/.npm && \
    chown -R node:node /usr/src/app /home/node/.npm

# Switch to non-root user
USER node

# Copy package.json files first for better caching
COPY --chown=node:node package*.json ./
COPY --chown=node:node client/package*.json ./client/
COPY --chown=node:node server/package*.json ./server/

# Install dependencies with verbose logging
RUN set -x && \
    npm ci --verbose || (cat /home/node/.npm/_logs/*-debug-0.log && exit 1) && \
    cd client && npm ci --verbose || (cat /home/node/.npm/_logs/*-debug-0.log && exit 1) && \
    cd ../server && npm ci --verbose || (cat /home/node/.npm/_logs/*-debug-0.log && exit 1)

# Copy the rest of the application code
COPY --chown=node:node . .

# Build the React app for production
RUN cd client && \
    export PATH="$PATH:./node_modules/.bin" && \
    npm run build

# Make port 3001 available
EXPOSE 3001

# Define environment variable
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=verbose

# Start the server
CMD ["node", "server/server.js"]