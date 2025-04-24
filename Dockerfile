FROM vercel/node

# Install libnss3
RUN apt-get update && apt-get install -y libnss3

# Copy application code
COPY . /app

# Install dependencies
RUN npm install

# Expose port
EXPOSE 3000

# Run command
CMD [ "npm", "start" ]