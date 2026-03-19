#!/bin/bash
# Build protobuf JAR for Flink
# Requires: protoc (protobuf compiler) and javac

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="${SCRIPT_DIR}"
BUILD_DIR="${PROTO_DIR}/build"
JAR_NAME="events.jar"

# Clean previous build
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/classes"

echo "Compiling protobuf to Java..."
protoc --proto_path="${PROTO_DIR}" \
       --java_out="${BUILD_DIR}" \
       "${PROTO_DIR}/events.proto"

echo "Compiling Java classes..."
# Find protobuf-java jar if available
PROTOBUF_JAR=$(find ~/.m2/repository -name "protobuf-java-*.jar" 2>/dev/null | head -1)

if [ -z "${PROTOBUF_JAR}" ]; then
    echo "Warning: protobuf-java.jar not found in Maven cache"
    echo "Downloading protobuf-java 3.25.1..."
    mkdir -p ~/.m2/repository/com/google/protobuf/protobuf-java/3.25.1
    curl -L -o ~/.m2/repository/com/google/protobuf/protobuf-java/3.25.1/protobuf-java-3.25.1.jar \
        "https://repo1.maven.org/maven2/com/google/protobuf/protobuf-java/3.25.1/protobuf-java-3.25.1.jar"
    PROTOBUF_JAR=~/.m2/repository/com/google/protobuf/protobuf-java/3.25.1/protobuf-java-3.25.1.jar
fi

# Compile Java files - target Java 11 for Flink 1.18 compatibility
find "${BUILD_DIR}" -name "*.java" > "${BUILD_DIR}/sources.txt"
javac -cp "${PROTOBUF_JAR}" \
      -target 11 \
      -source 11 \
      -d "${BUILD_DIR}/classes" \
      "@${BUILD_DIR}/sources.txt"

echo "Creating JAR file..."
cd "${BUILD_DIR}/classes"
jar cf "${PROTO_DIR}/${JAR_NAME}" .

echo "Created ${PROTO_DIR}/${JAR_NAME}"

# Cleanup
rm -rf "${BUILD_DIR}"

echo "Done!"
