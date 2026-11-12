#!/bin/sh
set -eu
# Trusted image entrypoint, before any selected source or dependency executes.
for tool in iptables ip6tables; do
 "$tool" -F OUTPUT
 "$tool" -A OUTPUT -o lo -j ACCEPT
 "$tool" -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
 "$tool" -P OUTPUT DROP
done
mkdir -p /tmp/hbl-data
chown 1000:1000 /tmp/hbl-data
cd /app
exec /usr/local/bin/bun /opt/hbl-preview-launch.js
