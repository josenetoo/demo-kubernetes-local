# Simple production-ish image for Node.js app
FROM node:20-alpine

WORKDIR /app

# Install only production deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
