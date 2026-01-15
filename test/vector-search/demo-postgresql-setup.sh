#!/bin/bash
# Demo: PostgreSQL as Document Database with Vector Search
# This shows how PostgreSQL + JSONB + pgvector can work as a document DB

set -e

CONTAINER_NAME="cams-postgres-jsonb-demo"
POSTGRES_VERSION="16"
POSTGRES_PORT="5432"
POSTGRES_PASSWORD="local-dev-password"  # pragma: allowlist secret
DATABASE_NAME="cams-local"

echo "🚀 Starting PostgreSQL ${POSTGRES_VERSION} with pgvector..."

# Check if container already exists
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "📦 Container ${CONTAINER_NAME} already exists"
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

# Start PostgreSQL container with pgvector extension
echo "🐳 Starting PostgreSQL + pgvector container..."
podman run -d \
    --name ${CONTAINER_NAME} \
    -p ${POSTGRES_PORT}:5432 \
    -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
    -e POSTGRES_DB=${DATABASE_NAME} \
    pgvector/pgvector:pg16

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Enable pgvector extension
echo "🔧 Enabling pgvector extension..."
podman exec ${CONTAINER_NAME} psql -U postgres -d ${DATABASE_NAME} -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo "✅ pgvector enabled"

# Create document-style table with vector search
echo "📝 Creating cases table (document + vector)..."
podman exec ${CONTAINER_NAME} psql -U postgres -d ${DATABASE_NAME} << 'SQL'
-- Cases table with JSONB document storage
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    case_id TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,              -- Full case document
    keywords TEXT[],                   -- Searchable keywords array
    keywords_vector vector(384),       -- 384-dim embeddings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_cases_data_gin ON cases USING GIN (data);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_case_status ON cases ((data->>'caseStatus'));
CREATE INDEX IF NOT EXISTS idx_debtor_name ON cases ((data->'debtor'->>'name'));

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_cases_vector ON cases
    USING hnsw (keywords_vector vector_cosine_ops);

-- Sample data
INSERT INTO cases (case_id, data, keywords, keywords_vector)
VALUES
    (
        '24-00001',
        '{
            "caseId": "24-00001",
            "debtor": {
                "name": "John Doe",
                "ssn": "XXX-XX-1234",
                "address": {
                    "street": "123 Main St",
                    "city": "New York",
                    "state": "NY",
                    "zip": "10001"
                }
            },
            "caseTitle": "John Doe",
            "caseStatus": "open",
            "chapter": "11",
            "dateFiled": "2024-01-15",
            "courtDivisionCode": "081"
        }'::jsonb,
        ARRAY['John Doe'],
        NULL  -- Would be actual 384-dim vector in production
    ),
    (
        '24-00002',
        '{
            "caseId": "24-00002",
            "debtor": {
                "name": "Jane Smith",
                "address": {
                    "city": "Boston",
                    "state": "MA"
                }
            },
            "jointDebtor": {
                "name": "John Smith"
            },
            "caseStatus": "open",
            "chapter": "7",
            "dateFiled": "2024-02-01"
        }'::jsonb,
        ARRAY['Jane Smith', 'John Smith'],
        NULL
    ),
    (
        '24-00003',
        '{
            "caseId": "24-00003",
            "debtor": {
                "name": "Robert Johnson",
                "address": {
                    "city": "Chicago",
                    "state": "IL"
                }
            },
            "caseStatus": "closed",
            "chapter": "13",
            "dateFiled": "2023-12-01",
            "dateClosed": "2024-03-01"
        }'::jsonb,
        ARRAY['Robert Johnson'],
        NULL
    )
ON CONFLICT (case_id) DO NOTHING;
SQL

echo "✅ Sample data inserted"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ PostgreSQL Document DB + Vector Search Ready!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Connection Details:"
echo "  Host:     localhost:${POSTGRES_PORT}"
echo "  Database: ${DATABASE_NAME}"
echo "  User:     postgres"
echo "  Password: ${POSTGRES_PASSWORD}"
echo ""
echo "Try these queries:"
echo ""
echo "  # Connect to database"
echo "  podman exec -it ${CONTAINER_NAME} psql -U postgres -d ${DATABASE_NAME}"
echo ""
echo "  # Query documents by nested field"
echo "  SELECT data FROM cases WHERE data->'debtor'->>'name' = 'John Doe';"
echo ""
echo "  # Query with JSON containment"
echo "  SELECT data FROM cases WHERE data @> '{\"caseStatus\": \"open\"}';"
echo ""
echo "  # Find cases in NY"
echo "  SELECT data FROM cases WHERE data->'debtor'->'address'->>'state' = 'NY';"
echo ""
echo "  # Combined document + vector query (would need actual vectors)"
echo "  SELECT case_id, data->'debtor'->>'name' as name"
echo "  FROM cases"
echo "  WHERE data->>'caseStatus' = 'open'"
echo "  -- ORDER BY keywords_vector <=> '[0.1,0.2,...]'::vector"
echo "  LIMIT 10;"
echo ""
echo "Next steps:"
echo "  1. Run demo queries: npx tsx test/vector-search/test-postgresql-jsonb.ts"
echo "  2. Compare with MongoDB approach"
echo "  3. Decide on implementation path"
echo ""
