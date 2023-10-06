FROM node:20-slim

RUN apt update && apt upgrade -y
RUN apt install graphviz -y
RUN npm install -g dependency-cruiser

WORKDIR /repo

# Mount host volume (pointing to repository) by using -v option to /repo
CMD ["sh","ops/docker/depcruise/script.sh"]
