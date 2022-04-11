FROM alpine:3.15 as builder
RUN apk add --no-cache go
RUN mkdir /app
WORKDIR /app
COPY proxy.go /app
RUN go mod init vncproxy && go mod tidy
RUN go build .

FROM ubuntu:20.04
RUN apt-get update && apt-get install -y locales
RUN locale-gen ja_JP.UTF-8 en_US.UTF-8 zh_CN.UTF-8
COPY . /app
COPY --from=builder /app/vncproxy /app/vncproxy
ENTRYPOINT bash /app/entrypoint.sh
