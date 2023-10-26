# Container running @axe-core/cli using Selenium WebDriver
FROM node:20-slim

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

RUN apt update && apt upgrade -y
RUN apt install -y wget unzip chromium-driver chromium && apt clean

USER node

RUN npm install -g @axe-core/cli
RUN npm install -g selenium-webdriver

ENTRYPOINT [ "axe", "--chromedriver-path=/usr/bin/chromedriver", "--load-delay=5000" ]
