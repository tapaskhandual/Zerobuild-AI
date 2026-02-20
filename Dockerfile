FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY . .

RUN npm run server:build

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["npm", "run", "server:prod"]
