# Operator-built trusted infrastructure image; never use a PR Dockerfile here.
FROM oven/bun:1@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d
USER root
RUN apt-get update && apt-get install -y --no-install-recommends iptables util-linux ca-certificates && rm -rf /var/lib/apt/lists/*
# Review/push this image separately and configure its immutable registry digest.
