FROM node:20-slim

RUN apt update && apt upgrade -y
RUN apt install -y wget unzip chromium-driver chromium
RUN npm install -g @axe-core/cli
RUN npm install -g selenium-webdriver

WORKDIR /repo

# axe https://www.google.com --chromedriver-path /usr/bin/chromedriver --chrome-options="no-sandbox,disable-setuid-sandbox,disable-dev-shm-usage"

# Mount host volume (pointing to repository) by using -v option to /repo
