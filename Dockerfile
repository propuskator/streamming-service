FROM node:12.5-alpine as base

WORKDIR /app
RUN apk update && apk add ffmpeg
COPY package*.json ./
RUN npm i

FROM base
WORKDIR /app
COPY . /app
CMD ./bin/wait.sh && npm start