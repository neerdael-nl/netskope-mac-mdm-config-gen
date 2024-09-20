# Use a more recent Node runtime as the parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the entire project directory into the container
COPY . .

# Install dependencies
RUN npm install

# Set permissions for the node user
RUN chown -R node:node /usr/src/app

# Switch to the node user
USER node

# Build the React app
RUN cd client && npm install && npm run build

# Make port 3001 available to the world outside this container
EXPOSE 3001

# Define environment variable
ENV NODE_ENV=production

# Run the app when the container launches
CMD ["node", "server/server.js"]