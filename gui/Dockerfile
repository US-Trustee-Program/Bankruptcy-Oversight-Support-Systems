FROM node:18.16.0-slim

# https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker

RUN apt-get update && apt-get install curl gnupg -y
RUN curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN apt-get update && apt-get install google-chrome-stable -y --no-install-recommends


RUN mkdir -p /usr/src/app
COPY . /usr/src/app/
WORKDIR /usr/src/app

RUN npm install
RUN npm run build

RUN npm install --global --unsafe-perm pa11y-ci

CMD npm run start
