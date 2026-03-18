#!/bin/bash
# Deploy script for Flink Event Pipeline
# Recompiles Protobuf, deploys to Flink, and initializes ClickHouse

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================================="
echo "  Deploying Flink Event Pipeline to Docker containers"
echo "=========================================================================="
echo ""

# Step 1: Recompile Protobuf to events.jar
echo "Step 1/5: Recompiling Protobuf definitions..."
./build.sh
echo "✅ Done"
echo ""

# Step 2: Copy events.jar to both Flink containers
echo "Step 2/5: Copying events.jar to Flink containers..."
docker cp ./events.jar flink-jobmanager:/opt/flink/protobuf/events.jar
docker cp ./events.jar flink-taskmanager:/opt/flink/protobuf/events.jar
echo "✅ Done"
echo ""

# Step 3: Copy event-pipeline.sql to Flink jobmanager
echo "Step 3/5: Copying updated SQL to Flink jobmanager..."
docker cp ./event-pipeline.sql flink-jobmanager:/opt/flink/protobuf/event-pipeline.sql
echo "✅ Done"
echo ""

# Step 4: Submit SQL job to Flink
echo "Step 4/5: Submitting Flink SQL job..."
echo "NOTE: Flink streaming jobs will run continuously after submission"
docker exec flink-jobmanager ./bin/sql-client.sh -f /opt/flink/protobuf/event-pipeline.sql
echo "✅ All DDL statements executed"
echo ""

# Step 5: Initialize ClickHouse tables
echo "Step 5/5: Initializing ClickHouse tables..."
docker cp ./clickhouse-init.sql clickhouse:/tmp/clickhouse-init.sql
docker exec -i clickhouse clickhouse-client -n < /tmp/clickhouse-init.sql
echo "✅ All ClickHouse tables created"
echo ""

echo "=========================================================================="
echo "  Deployment Complete!"
echo "=========================================================================="
echo ""
echo "Summary:"
echo "  - Protobuf classes recompiled (Java 11 compatible): events.jar"
echo "  - Flink SQL tables created: 6 sources, 7 sinks"
echo "  - 7 streaming jobs submitted"
echo "  - ClickHouse initialized: 7 Kafka Engine, 7 MergeTree, 7 Materialized Views"
echo ""
echo "Check running jobs at: http://localhost:8081"
echo "Check ClickHouse tables with: docker exec -it clickhouse clickhouse-client"
echo ""
