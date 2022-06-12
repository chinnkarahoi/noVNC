#!/bin/bash
go build -mod=mod .
./vncproxy --static ./ -vncAddress localhost:5900
