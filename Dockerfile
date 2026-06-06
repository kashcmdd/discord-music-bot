FROM node:20-alpine

RUN apk add --no-cache yt-dlp ffmpeg python3

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "src/index.js"]
