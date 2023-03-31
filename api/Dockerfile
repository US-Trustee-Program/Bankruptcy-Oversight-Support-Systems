FROM node:18.15.0-alpine3.17

RUN mkdir -p /usr/src/app
COPY . /usr/src/app/
WORKDIR /usr/src/app
RUN ls > ls-output.txt

RUN npm install
#RUN npm run build

CMD npm run start
