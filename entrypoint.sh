#!/bin/bash
cd /app || exit 1
/app/vncproxy --static /app/static -vncAddress localhost:5901
