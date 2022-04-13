#!/bin/bash
cd /app || exit 1
VNC_ADDRESS=${VNC_ADDRESS:-localhost:5900}
/app/vncproxy --static /app -vncAddress $VNC_ADDRESS
