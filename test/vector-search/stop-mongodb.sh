#!/bin/bash
# Stop and remove MongoDB container

CONTAINER_NAME="cams-vector-test-mongo"

echo "🛑 Stopping MongoDB container..."

if podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    podman stop ${CONTAINER_NAME}
    echo "✅ Container stopped"
else
    echo "ℹ️  Container is not running"
fi

echo ""
read -p "Remove container and data volume? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        podman rm ${CONTAINER_NAME}
        echo "✅ Container removed"
    fi

    if podman volume ls --format "{{.Name}}" | grep -q "^mongo-vector-test-data$"; then
        podman volume rm mongo-vector-test-data
        echo "✅ Volume removed"
    fi

    echo "🧹 Cleanup complete"
else
    echo "ℹ️  Container preserved (use 'podman start ${CONTAINER_NAME}' to restart)"
fi
