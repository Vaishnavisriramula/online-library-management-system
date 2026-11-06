
FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY server.js database.js ./

COPY public ./public

RUN mkdir -p /app/data

ENV DB_PATH=/app/data/library.db

EXPOSE 3000

CMD ["node", "server.js"]
