# Custom Flink image with pre-installed Kafka and Protobuf connectors
# Based on official Flink 1.18 image
FROM flink:1.18-scala_2.12

# Copy all required connector JARs to /opt/flink/lib
# These will be on the classpath when Flink starts
COPY ./lib/*.jar /opt/flink/lib/
COPY ./protobuf/events.jar /opt/flink/lib/

# Set permissions
RUN chown -R flink:flink /opt/flink/lib/
