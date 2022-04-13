FROM alpine:3.15 as builder
RUN apk add --no-cache go
RUN apk add --no-cache libx11 libx11-dev
RUN mkdir /app
WORKDIR /app
COPY go.mod /app
RUN go mod download
COPY proxy.go /app
RUN go mod tidy
RUN go build .
RUN exit 1

FROM alpine:3.15
RUN apk add --no-cache bash
COPY . /app
COPY --from=builder /app/vncproxy /app/vncproxy
ENTRYPOINT bash /app/entrypoint.sh
