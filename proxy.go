package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"golang.design/x/clipboard"
	"golang.org/x/net/websocket"
)

func main() {
	staticDir := flag.String("static", "./static", "Html static directory")
	downloadsDir := flag.String("downloads", "./downloads", "Html static directory")
	address := flag.String("address", ":8888", "Server port")
	udpAddress := flag.String("udpAddress", ":1234", "Jsmpeg Udp Server port")
	vncAddress := flag.String("vncAddress", "localhost:5900", "Vnc Server port")
	flag.Parse()

	passwd := os.Getenv("VNC_PASSWD")
	http.HandleFunc("/", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Add("Location",
			fmt.Sprintf("/static/vnc.html?autoconnect=true&resize=scale&reconnect=true&reconnect_delay=1000&password=%v", passwd),
		)
		writer.WriteHeader(302)
	})

	http.Handle("/clipboard", websocket.Handler(func(wsconn *websocket.Conn) {
		log.Println("CLIPBOARD OPEN")
		ctx, cancel := context.WithCancel(context.Background())
		defer func() {
			cancel()
			wsconn.Close()
		}()
		for {
			log.Println("connecting to clipboard")
			err := clipboard.Init()
			if err != nil {
				log.Println(err)
			} else {
				log.Println("connected to clipboard")
				break
			}
		}
		ch := clipboard.Watch(ctx, clipboard.FmtText)
		wsconn.PayloadType = websocket.TextFrame
		// keep alive
		go func() {
			for {
				_, err := wsconn.Write([]byte{65})
				if err != nil {
					log.Println(err)
					break
				}
				time.Sleep(time.Second)
			}
		}()
		go func() {
			data := make([]byte, 65536)
			for {
				n, err := wsconn.Read(data)
				if err != nil {
					log.Println(err)
					break
				}
				if n != 1 {
					clipboard.Write(clipboard.FmtText, data)
				}
			}
			wsconn.Close()
		}()
		for data := range ch {
			_, err := wsconn.Write(data)
			if err != nil {
				log.Println(err)
				break
			}
		}
		log.Println("CLIPBOARD CLOSED")
	}))

	http.Handle("/websockify", websocket.Handler(func(wsconn *websocket.Conn) {
		defer wsconn.Close()
		var d net.Dialer
		var address = *vncAddress
		conn, err := d.DialContext(wsconn.Request().Context(), "tcp", address)
		if err != nil {
			log.Printf("[%s] [VNC_ERROR] [%v]", address, err)
			return
		}
		defer conn.Close()
		wsconn.PayloadType = websocket.BinaryFrame
		go func() {
			io.Copy(wsconn, conn)
			wsconn.Close()
			log.Printf("[%s] [VNC_SESSION_CLOSED]", address)
		}()
		io.Copy(conn, wsconn)
		log.Printf("[%s] [VNC_CLIENT_DISCONNECTED]", address)
	}))
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(*staticDir))))
	http.Handle("/downloads", http.StripPrefix("/downloads/", http.FileServer(http.Dir(*downloadsDir))))
	http.HandleFunc("/ping", func(writer http.ResponseWriter, request *http.Request) {
		writer.Write([]byte("pong"))
	})
	var writers = new(WsMultiWriter)
	writers.writers = map[*websocket.Conn]chan *[]byte{}
	go func() {
		RunJsmpegUDP(*udpAddress, writers)
	}()
	http.Handle("/audio", websocket.Handler(func(conn *websocket.Conn) {
		defer conn.Close()
		conn.PayloadType = websocket.BinaryFrame
		ch := make(chan *[]byte, 1)
		writers.writers[conn] = ch
		for {
			select {
			case <-ch:
			}
			break
		}
	}))
	log.Printf("Http listening os %s \n", *address)

	log.Fatal(http.ListenAndServe(*address, nil))

}

func RunJsmpegUDP(address string, writer io.Writer) {
	udpAddr, _ := net.ResolveUDPAddr("udp4", address)

	//监听端口
	udpConn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		fmt.Println(err)
	}
	defer udpConn.Close()

	fmt.Printf("Jsmpeg udp listening on %s \n", address)
	io.Copy(writer, udpConn)

}

type WsMultiWriter struct {
	writers map[*websocket.Conn]chan *[]byte
}

func (t *WsMultiWriter) Write(p []byte) (n int, err error) {
	for k, v := range t.writers {
		if v == nil {
			continue
		}
		n, err = k.Write(p)
		if err != nil {
			v <- nil
			t.writers[k] = nil
			continue
		}
		if n != len(p) {
			return
		}
	}
	return len(p), nil
}
