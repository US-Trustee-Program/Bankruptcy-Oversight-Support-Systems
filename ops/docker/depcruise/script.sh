#!/usr/bin/env bash

DEFAULT_DIR=$(pwd)

echo "Executing depcruise on frontend"
cd common || exit
npm run dependency-cruiser-graphical
cd "${DEFAULT_DIR}" || exit

echo "Executing depcruise on backend"
cd backend/functions || exit
npm run dependency-cruiser-graphical
cd "${DEFAULT_DIR}" || exit

echo "Executing depcruise on frontend"
cd user-interface || exit
npm run dependency-cruiser-graphical
cd "${DEFAULT_DIR}" || exit

echo "depcruise completed"
