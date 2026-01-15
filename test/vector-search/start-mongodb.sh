#!/bin/bash
# Start MongoDB 7.0 for vector search testing using Podman

set -e

CONTAINER_NAME="cams-vector-test-mongo"
MONGO_VERSION="7.0"
MONGO_PORT="27017"
DATABASE_NAME="cams-local"

echo "🚀 Starting MongoDB ${MONGO_VERSION} for vector search testing..."

# Check if container already exists
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "📦 Container ${CONTAINER_NAME} already exists"

    # Check if it's running
    if podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "✅ Container is already running"
        exit 0
    else
        echo "🔄 Starting existing container..."
        podman start ${CONTAINER_NAME}
        echo "✅ Container started"
        exit 0
    fi
fi

# Create a volume for persistent data
echo "📁 Creating volume..."
podman volume create mongo-vector-test-data 2>/dev/null || echo "   Volume already exists"

# Start MongoDB container with replica set (no auth for local testing)
echo "🐳 Starting MongoDB container..."
podman run -d \
    --name ${CONTAINER_NAME} \
    -p ${MONGO_PORT}:27017 \
    -e MONGO_INITDB_DATABASE=${DATABASE_NAME} \
    -v mongo-vector-test-data:/data/db \
    mongo:${MONGO_VERSION} \
    mongod --replSet rs0 --bind_ip_all --noauth

echo "⏳ Waiting for MongoDB to be ready..."
sleep 5

# Initialize replica set (required for vector operations)
echo "🔧 Initializing replica set..."
podman exec ${CONTAINER_NAME} mongosh --eval "
try {
  rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'localhost:27017' }]
  });
  print('✅ Replica set initiated');
} catch(e) {
  if (e.codeName === 'AlreadyInitialized') {
    print('✅ Replica set already initialized');
  } else {
    throw e;
  }
}
" 2>/dev/null || echo "   Replica set initialization attempted"

echo "⏳ Waiting for replica set to become ready..."
sleep 3

# Create the database and collection
echo "📝 Creating database and collection..."
podman exec ${CONTAINER_NAME} mongosh --eval "
db = db.getSiblingDB('${DATABASE_NAME}');
db.createCollection('cases');
print('✅ Database and collection created');
" 2>/dev/null || echo "   Database setup attempted"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ MongoDB is ready for vector search testing!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Connection Details:"
echo "  Host:      localhost:${MONGO_PORT}"
echo "  Database:  ${DATABASE_NAME}"
echo "  Auth:      disabled (local testing)"
echo "  Replica:   rs0"
echo ""
echo "Next steps:"
echo "  1. Run the test: npx tsx test/vector-search/test-vector-search.ts"
echo "  2. Stop MongoDB: ./test/vector-search/stop-mongodb.sh"
echo ""
