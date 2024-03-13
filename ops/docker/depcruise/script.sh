#!/usr/bin/env bash

set -eu

CURRENT_TIMESTAMP=$(date +'%Y-%m-%d_%H%M')
DEFAULT_DIR=$(pwd)
DOCUMENT_DIR="${DEFAULT_DIR}/docs/architecture/dependency-cruiser"

echo "Executing depcruise on common"
cd common || exit
npx depcruise \
    --output-type dot \
    --do-not-follow '^node_modules($|/)' \
    src | dot -T svg > "${DOCUMENT_DIR}/common/dp_common_${CURRENT_TIMESTAMP}.svg"
cd "${DEFAULT_DIR}" || exit
echo "Completed common"

echo "Executing depcruise on backend"
cd backend/functions || exit
npx depcruise \
    --output-type dot \
    --do-not-follow '^node_modules($|/)' \
    attorneys case-assignments case-docket case-history case-summary cases consolidations healthcheck offices orders orders-manual-sync orders-sync lib | dot -T svg > "${DOCUMENT_DIR}/functions/dp_api_${CURRENT_TIMESTAMP}.svg"
cd "${DEFAULT_DIR}" || exit
echo "Completed backend"

echo "Executing depcruise on frontend"
cd user-interface || exit
npx depcruise \
    --output-type dot \
    --do-not-follow '^node_modules($|/)' \
    --exclude 'test|scss' \
    public src | dot -T svg > "${DOCUMENT_DIR}/user-interface/dp_${CURRENT_TIMESTAMP}.svg"
cd "${DEFAULT_DIR}" || exit
echo "Completed frontend"
