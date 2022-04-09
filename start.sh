#!/bin/bash
export DISPLAY=":0"
export DPI=${DPI:-96}
export RESOLUTION=${RESOLUTION:-1280x720}
export LC_ALL=en_US.UTf-8
export TZ=Asia/Shanghai
export XDG_RUNTIME_DIR='/home/gjs/.config'

function shutdown {
  pkill -9 kwin_x11
  pkill -9 vncproxy
  pkill -9 baloo_file
}
shutdown
trap "shutdown" INT EXIT
balooctl disable && balooctl purge && balooctl enable

mkdir -p /home/gjs
chown gjs /home/gjs
chown gjs /home/gjs/.wine
chown gjs /home/gjs/Desktop
echo "gjs:$PASSWD" | sudo chpasswd

export PULSE_SERVER=127.0.0.1:4713
sudo pulseaudio --verbose --realtime=true -L "module-native-protocol-tcp auth-ip-acl=127.0.0.0/8 port=4713 auth-anonymous=1" -D
ffmpeg -y -nostdin -f alsa -i pulse -f mpegts -codec:a mp2 -muxdelay 0.01 udp://localhost:1234 &

sudo /etc/init.d/dbus start

Xtigervnc "$DISPLAY" -desktop gjs -geometry ${RESOLUTION} -dpi ${DPI} -depth 32 -rfbwait 3000000 -rfbport 5901 -pn -localhost -SecurityTypes None -listen tcp -ac &
plasma_session &
./vncproxy --static ./ -vncAddress localhost:5901 &

wait -n
