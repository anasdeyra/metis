#!/usr/bin/env bash
# FortiGate IKEv1 (PSK + xauth) VPN via strongSwan.
# Usage: vpn.sh setup | up | down | status
set -euo pipefail

CONN=fortigate
DIR=$(cd "$(dirname "$0")" && pwd)

stop_stray_daemon() {
    # A daemon started outside systemd leaves pid files that block the service.
    if pgrep -x charon >/dev/null && ! systemctl is-active --quiet strongswan-starter; then
        sudo ipsec stop || true
        sudo pkill -x charon || true
        sudo rm -f /var/run/charon.pid /var/run/starter.charon.pid
    fi
}

setup() {
    dpkg -s strongswan-starter libcharon-extra-plugins >/dev/null 2>&1 \
        || sudo apt install -y strongswan-starter libcharon-extra-plugins

    read -rp "Username (xauth): " VPN_USER
    read -rsp "Password (xauth, hidden): " VPN_PASS; echo
    read -rsp "Pre-shared key (hidden): " PSK; echo

    sudo cp -n /etc/ipsec.conf /etc/ipsec.conf.bak
    sed "s|@VPN_USER@|$VPN_USER|" "$DIR/ipsec.conf" | sudo tee /etc/ipsec.conf >/dev/null
    sudo tee /etc/ipsec.secrets >/dev/null <<EOS
@devnomad : PSK "$PSK"
$VPN_USER : XAUTH "$VPN_PASS"
EOS
    sudo chmod 600 /etc/ipsec.secrets

    stop_stray_daemon
    sudo systemctl enable strongswan-starter
    sudo systemctl restart strongswan-starter
    sleep 5
    echo "Setup done. Connect with: $0 up"
}

case "${1:-}" in
    setup)  setup ;;
    up)     stop_stray_daemon; sudo systemctl start strongswan-starter; sleep 3; sudo ipsec up "$CONN" ;;
    down)   sudo ipsec down "$CONN" ;;
    status) sudo ipsec statusall ;;
    *)      echo "Usage: $0 setup|up|down|status"; exit 1 ;;
esac
