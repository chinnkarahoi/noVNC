FROM golang:1.17 as builder
RUN mkdir /app
WORKDIR /app
COPY proxy.go /app
RUN go build -o vncproxy proxy.go

FROM alpine:3.15
RUN apk add --no-cache bash
COPY . /app
COPY --from=builder /app/vncproxy /app/vncproxy
ENTRYPOINT bash /app/entrypoint.sh
