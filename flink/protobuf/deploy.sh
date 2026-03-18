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
echo "NOTE: Creating tables first, then submitting streaming jobs in detached mode"
echo ""

# Split the file on the host first to avoid escaping issues inside docker
echo "  Extracting DDL (CREATE TABLE statements)..."
rm -f /tmp/flink-deploy-ddl.sql /tmp/flink-deploy-inserts.txt
# Extract ADD JAR and CREATE TABLE statements
awk '
  /^ADD JAR/ || /^CREATE TABLE/ {
    in_create = 1;
    print $0;
    next;
  }
  in_create && /^);/ {
    print $0;
    print "";
    in_create = 0;
    next;
  }
  in_create {
    print $0;
    next;
  }
' "$SCRIPT_DIR/event-pipeline.sql" > /tmp/flink-deploy-ddl.sql

# Extract complete INSERT statements
echo "  Extracting INSERT statements..."
awk '
  /^INSERT INTO/ {
    in_insert = 1;
    stmt = $0;
    # INSERT spans multiple lines ending with ;
    need_semicolon = 1;
    next;
  }
  in_insert && /;/ {
    stmt = stmt " " $0;
    print stmt;
    in_insert = 0;
    need_semicolon = 0;
    next;
  }
  in_insert {
    stmt = stmt " " $0;
    next;
  }
' "$SCRIPT_DIR/event-pipeline.sql" > /tmp/flink-deploy-inserts.txt

# Copy to container
docker cp /tmp/flink-deploy-ddl.sql flink-jobmanager:/tmp/flink-deploy-ddl.sql
docker cp /tmp/flink-deploy-inserts.txt flink-jobmanager:/tmp/flink-deploy-inserts.txt

# Execute DDL
echo "  Creating tables..."
docker exec flink-jobmanager ./bin/sql-client.sh -f /tmp/flink-deploy-ddl.sql
echo "✅ All tables created"
echo ""

# Submit each INSERT in detached mode
echo "  Submitting 7 streaming jobs (detached mode):"
count=0
while read -r stmt; do
  if [ -n "$stmt" ]; then
    count=$((count+1))
    table_name=$(echo "$stmt" | awk '/INSERT INTO/ {print $3}')
    echo "    [$count] $table_name"
    docker exec flink-jobmanager ./bin/sql-client.sh -D execution.target=remote -i /tmp/flink-deploy-ddl.sql -u "$stmt" >/dev/null 2>&1
    sleep 2
  fi
done < /tmp/flink-deploy-inserts.txt

echo ""
echo "✅ $count streaming jobs submitted"
echo "NOTE: In development environment (single task slot), only one job can run at a time"
echo "      Flink will automatically retry jobs when a slot becomes available"
echo ""

# Cleanup temp files
rm -f /tmp/flink-deploy-ddl.sql /tmp/flink-deploy-inserts.txt

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
echo "  - $count streaming jobs submitted"
echo "  - ClickHouse initialized: 7 Kafka Engine, 7 MergeTree, 7 Materialized Views"
echo ""
echo "Check running jobs at: http://localhost:8081"
echo "Check ClickHouse tables with: docker exec -it clickhouse clickhouse-client"
echo ""
