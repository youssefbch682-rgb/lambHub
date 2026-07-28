FROM node:20-alpine

# Nécessaire pour compiler better-sqlite3 (bindings natifs)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 4000
CMD ["node", "src/index.js"]
