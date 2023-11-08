# Container running @axe-core/cli using Selenium WebDriver
FROM node:20-alpine3.18

RUN apk update && apk upgrade
RUN apk add chromium chromium-chromedriver && apk cache clean

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

USER node

RUN npm install -g @axe-core/cli
RUN npm install -g selenium-webdriver

ENTRYPOINT [ "axe", "--chromedriver-path=/usr/bin/chromedriver", "--load-delay=5000" ]
