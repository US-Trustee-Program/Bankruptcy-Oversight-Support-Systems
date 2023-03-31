FROM node:18.15.0-alpine3.17

RUN mkdir -p /usr/src/app
COPY . /usr/src/app/
WORKDIR /usr/src/app

RUN npm install
RUN npm run build

CMD npm run start
