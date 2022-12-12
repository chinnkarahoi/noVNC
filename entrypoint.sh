#!/bin/bash
cd /app || exit 1
VNC_ADDRESS=${VNC_ADDRESS:-localhost:5900}
PROXY_PORT=${PROXY_PORT:-8888}
/app/vncproxy --address :${PROXY_PORT} --static /app -vncAddress $VNC_ADDRESS
