FROM node:20-slim

RUN apt update && apt upgrade -y
RUN apt install -y wget unzip libglib2.0-0 libsm6 libxrender1 libxext6 libnss3 libgtk2.0-0 libgconf-2-4
RUN npm install -g selenium-webdriver
RUN npm install -g @axe-core/cli

WORKDIR /tmp
# CMD wget https://msedgedriver.azureedge.net/118.0.2088.57/edgedriver_linux64.zip

CMD wget http://chromedriver.storage.googleapis.com/2.0/chromedriver_linux64.zip
CMD unzip ./chromedriver_linux64.zip
CMD mv ./chromedriver_linux64/chromedriver /usr/bin

# WORKDIR /repo

# Mount host volume (pointing to repository) by using -v option to /repo
