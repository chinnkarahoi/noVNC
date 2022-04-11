#!/bin/bash
cd /app || exit 1
/app/vncproxy --static /app -vncAddress localhost:5901
