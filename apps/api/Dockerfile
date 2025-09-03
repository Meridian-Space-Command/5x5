FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
EXPOSE 4000
CMD ["npm", "run", "dev"]


