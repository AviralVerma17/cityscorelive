FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV DB_FILE=/app/data/cityscore.db

EXPOSE 4000

CMD ["node", "src/server.js"]
