# syntax=docker/dockerfile:1
# Ultra-lightweight C17 Compilation & Execution Sandbox Image for 2C2G Hosts
FROM alpine:3.20

COPY lv_seccomp.c /tmp/lv_seccomp.c

RUN apk add --no-cache gcc musl-dev && \
    apk add --no-cache --virtual .build-seccomp linux-headers && \
    gcc -O2 -Wall -Wextra -c /tmp/lv_seccomp.c -o /usr/local/lib/lv_seccomp.o && \
    rm -f /tmp/lv_seccomp.c && \
    apk del .build-seccomp && \
    # Strip all setuid/setgid bits across the root filesystem to prevent privilege escalation
    find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true && \
    # Remove network/shell utilities unnecessary for C17 compilation
    rm -f /usr/bin/wget /usr/bin/nc /bin/su /usr/bin/passwd 2>/dev/null || true && \
    mkdir -p /workspace /input && \
    chown 65534:65534 /workspace

USER 65534:65534
WORKDIR /workspace
