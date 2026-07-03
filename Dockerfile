# Playwright base image ships Chromium + all system libs (reliable on Render/Railway/Fly).
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
# postinstall runs `playwright install chromium` to match the installed version.
RUN npm install --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
