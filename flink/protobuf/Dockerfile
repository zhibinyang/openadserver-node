# Build protobuf JAR for Flink
FROM eclipse-temurin:11-jdk AS builder

RUN apt-get update && apt-get install -y protobuf-compiler && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY events.proto .

RUN protoc --proto_path=. --java_out=. events.proto && \
    mkdir -p classes && \
    curl -L -o /tmp/protobuf-java.jar \
        "https://repo1.maven.org/maven2/com/google/protobuf/protobuf-java/3.25.1/protobuf-java-3.25.1.jar" && \
    find . -name "*.java" > sources.txt && \
    javac -cp /tmp/protobuf-java.jar -d classes @sources.txt && \
    cd classes && jar cf /build/events.jar .

# Final stage - just the JAR
FROM scratch AS artifact
COPY --from=builder /build/events.jar /events.jar
