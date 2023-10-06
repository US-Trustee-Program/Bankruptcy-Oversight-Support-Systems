#!/usr/bin/env bash

DEFAULT_DIR=$(pwd)

echo "Executing depcruise on backend"
cd backend/functions
npm run dependency-cruiser-graphical
cd $DEFAULT_DIR

echo "Executing depcruise on frontend"
cd user-interface
npm run dependency-cruiser-graphical
cd $DEFAULT_DIR

echo "depcruise completed"
