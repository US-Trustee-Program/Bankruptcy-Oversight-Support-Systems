FROM node:20-slim

RUN apt update && apt upgrade -y
RUN apt install graphviz -y
RUN npm install -g dependency-cruiser

# Idea for using containers to generate depdency-cruiser artifacts
# During running of image
#   copy source
#   execute npm script to create dependency cruiser artifacts
#   copy images to host
#   BONUS: create a makefile to run docker command
