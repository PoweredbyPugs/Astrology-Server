FROM node:18-bullseye

WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies
RUN npm install

# Copy server.js file
COPY server.js ./

# Create directories for natal charts and ephemeris
RUN mkdir -p natal_charts
RUN mkdir -p ephemeris

# Declare the volume for ephemeris
VOLUME /app/ephemeris
VOLUME /app/natal_charts

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]