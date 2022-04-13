#!/bin/bash
cd /app || exit 1
VNC_ADDRESS=${VNC_ADDRESS:-localhost:5900}
PULSE_ADDRESS=${PULSE_ADDRESS:-localhost:1234}
/app/vncproxy --static /app -vncAddress $VNC_ADDRESS -udpAddress $PULSE_ADDRESS
