FROM alpine:3.15 as builder
RUN apk add --no-cache go
RUN mkdir /app
WORKDIR /app
COPY proxy.go /app
RUN go mod init vncproxy && go mod tidy
RUN go build .

FROM alpine:3.15
RUN apk add --no-cache bash
COPY . /app
COPY --from=builder /app/vncproxy /app/vncproxy
ENTRYPOINT bash /app/entrypoint.sh
