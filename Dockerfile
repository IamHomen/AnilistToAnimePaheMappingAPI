# Use a Node base image
FROM mcr.microsoft.com/playwright:v1.43.1-focal

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npx playwright install --with-deps

CMD ["npm", "start"]