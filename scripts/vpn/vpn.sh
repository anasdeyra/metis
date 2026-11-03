#!/usr/bin/env bash
# FortiGate IKEv1 (PSK + xauth) VPN via strongSwan.
# Usage: vpn.sh setup | apply | up | down | status
# Full tunnel: all traffic + DNS (VPN_DNS, default 10.200.3.250) go through the VPN.
set -euo pipefail

CONN=fortigate
VPN_DNS=${VPN_DNS:-10.200.3.250}
SERVER=46.17.87.38
DIR=$(cd "$(dirname "$0")" && pwd)

stop_stray_daemon() {
    # A daemon started outside systemd leaves pid files that block the service.
    if pgrep -x charon >/dev/null && ! systemctl is-active --quiet strongswan-starter; then
        sudo ipsec stop || true
        sudo pkill -x charon || true
        sudo rm -f /var/run/charon.pid /var/run/starter.charon.pid
    fi
}

# Never let strongSwan touch DNS: the pushed server made resolvconf/resolv.conf
# point at an unreachable resolver and froze the terminal.
disable_dns_plugin() {
    sudo mkdir -p /etc/strongswan.d/charon
    printf 'resolve {\n    load = no\n}\n' | sudo tee /etc/strongswan.d/charon/resolve.conf >/dev/null
}

# sudo resolves the hostname on every call; with the tunnel up that lookup goes
# through the VPN and stalls the shell, so pin it locally.
ensure_hostname_local() {
    local h; h=$(hostname)
    grep -qE "[[:space:]]$h([[:space:]]|\$)" /etc/hosts \
        || echo "127.0.1.1 $h" | sudo tee -a /etc/hosts >/dev/null
}

# Interface used to reach the VPN server (the physical uplink).
uplink_if() { ip -o route get "$SERVER" | sed -n 's/.* dev \([^ ]*\).*/\1/p'; }

setup() {
    dpkg -s strongswan-starter libcharon-extra-plugins >/dev/null 2>&1 \
        || sudo apt install -y strongswan-starter libcharon-extra-plugins

    read -rp "Username (xauth): " VPN_USER
    read -rsp "Password (xauth, hidden): " VPN_PASS; echo
    read -rsp "Pre-shared key (hidden): " PSK; echo

    ensure_hostname_local
    sudo cp -n /etc/ipsec.conf /etc/ipsec.conf.bak
    sed "s|@VPN_USER@|$VPN_USER|" "$DIR/ipsec.conf" | sudo tee /etc/ipsec.conf >/dev/null
    sudo tee /etc/ipsec.secrets >/dev/null <<EOS
@devnomad : PSK "$PSK"
$VPN_USER : XAUTH "$VPN_PASS"
EOS
    sudo chmod 600 /etc/ipsec.secrets

    disable_dns_plugin
    stop_stray_daemon
    sudo systemctl enable strongswan-starter
    sudo systemctl restart strongswan-starter
    sleep 5
    echo "Setup done. Connect with: $0 up"
}

# Reinstall ipsec.conf + DNS setting without re-entering credentials.
apply() {
    local user
    user=$(sudo awk '/xauth_identity=/{sub(/.*=/,"");print;exit}' /etc/ipsec.conf)
    [[ -n $user && $user != @VPN_USER@ ]] || { echo "No installed config found; run: $0 setup"; exit 1; }
    sed "s|@VPN_USER@|$user|" "$DIR/ipsec.conf" | sudo tee /etc/ipsec.conf >/dev/null
    ensure_hostname_local
    disable_dns_plugin
    stop_stray_daemon
    sudo systemctl restart strongswan-starter
    sleep 3
    echo "Applied. Connect with: $0 up"
}

up() {
    down quiet
    local ifc; ifc=$(uplink_if)
    stop_stray_daemon
    sudo systemctl start strongswan-starter
    sleep 3
    sudo ipsec up "$CONN"
    sudo resolvectl dns "$ifc" "$VPN_DNS"
    sudo resolvectl domain "$ifc" '~.'
    echo "VPN up: DNS $VPN_DNS on $ifc"
}

down() {
    sudo ipsec down "$CONN" >/dev/null 2>&1 || true
    # Restore the DHCP DNS (from NetworkManager) if the VPN overrode it.
    local ifc dns dom
    ifc=$(uplink_if)
    if [[ -n $ifc ]] && resolvectl dns "$ifc" 2>/dev/null | grep -q "$VPN_DNS"; then
        dns=$(nmcli -g IP4.DNS device show "$ifc" | tr '|' ' ')
        dom=$(nmcli -g IP4.DOMAIN device show "$ifc" | tr '|' ' ')
        # shellcheck disable=SC2086
        sudo resolvectl dns "$ifc" $dns
        # shellcheck disable=SC2086
        sudo resolvectl domain "$ifc" $dom
        sudo resolvectl default-route "$ifc" yes
    fi
    [[ ${1:-} == quiet ]] || echo "VPN down"
}

case "${1:-}" in
    setup)  setup ;;
    apply)  apply ;;
    up)     up ;;
    down)   down ;;
    status) sudo ipsec statusall ;;
    *)      echo "Usage: $0 setup|apply|up|down|status"; exit 1 ;;
esac
