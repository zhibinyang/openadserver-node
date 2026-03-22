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
echo "Step 1/6: Recompiling Protobuf definitions..."
./build.sh
echo "✅ Done"
echo ""

# Step 2: Copy events.jar to both Flink containers (protobuf directory and lib directory for classpath)
echo "Step 2/6: Copying events.jar to Flink containers..."
docker cp ./events.jar flink-jobmanager:/opt/flink/protobuf/events.jar
docker cp ./events.jar flink-taskmanager:/opt/flink/protobuf/events.jar
echo "✅ Done"
echo ""

# Step 3: Pre-create downstream Kafka topics
echo "Step 3/6: Pre-creating Kafka topics for Flink pipelines..."
docker exec kafka /opt/kafka/bin/kafka-topics.sh --create --topic FLINK_AD_IMPRESSION --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists
docker exec kafka /opt/kafka/bin/kafka-topics.sh --create --topic FLINK_AD_CLICK --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists
docker exec kafka /opt/kafka/bin/kafka-topics.sh --create --topic FLINK_AD_CONVERSION --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists
echo "✅ Topics created or already exist"
echo ""

# Step 4: Submit SQL job to Flink
echo "Step 4/6: Submitting complete Flink SQL job..."
echo "NOTE: All statements (ADD JAR, CREATE TABLE, 7 streaming jobs) executed in one session"
echo ""

# Submit the entire file in one go - all statements in same session guarantees tables exist
docker cp "$SCRIPT_DIR/event-pipeline.sql" flink-jobmanager:/tmp/event-pipeline.sql
docker exec flink-jobmanager ./bin/sql-client.sh -D execution.target=remote -f /tmp/event-pipeline.sql
echo "✅ Complete job submitted"
echo ""

# Step 5: Submit Calibration SQL job to Flink
echo "Step 5/6: Submitting Calibration Pipeline Flink SQL job..."
docker cp "$SCRIPT_DIR/calibration-pipeline.sql" flink-jobmanager:/tmp/calibration-pipeline.sql
docker exec flink-jobmanager ./bin/sql-client.sh -D execution.target=remote -f /tmp/calibration-pipeline.sql
echo "✅ Calibration job submitted"
echo ""

# Step 6: Initialize ClickHouse tables
echo "Step 6/6: Initializing ClickHouse tables..."
docker cp ./clickhouse-init.sql clickhouse:/tmp/clickhouse-init.sql
docker exec -i clickhouse sh -c 'clickhouse-client -n < /tmp/clickhouse-init.sql'
echo "✅ All ClickHouse tables created"
echo ""

echo "=========================================================================="
echo "  Deployment Complete!"
echo "=========================================================================="
echo ""
echo "Summary:"
echo "  - Protobuf classes recompiled (Java 11 compatible): events.jar"
echo "  - events.jar copied to Flink (protobuf + lib directory for classpath)"
echo "  - Intermediate Kafka topics pre-created"
echo "  - Flink SQL tables created: 6 sources, 7 sinks"
echo "  - 7 streaming jobs submitted"
echo "  - Calibration Pipeline job submitted"
echo "  - ClickHouse initialized: 7 Kafka Engine, 7 MergeTree, 7 Materialized Views"
echo ""
echo "Check running jobs at: http://localhost:8081"
echo "Check ClickHouse tables with: docker exec -it clickhouse clickhouse-client"
echo ""
