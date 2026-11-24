# syntax=docker/dockerfile:1
# Low-Footprint Java 21 Sandbox Image for 2C2G Hosts (Paired with Semaphore=1 & SerialGC)
FROM eclipse-temurin:21-jdk-alpine

RUN find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true && \
    rm -f /usr/bin/wget /usr/bin/nc /bin/su /usr/bin/passwd 2>/dev/null || true && \
    mkdir -p /workspace /input && \
    chown 65534:65534 /workspace

USER 65534:65534
WORKDIR /workspace
