#!/bin/bash
go build .
./vncproxy --static ./ -vncAddress localhost:5900
