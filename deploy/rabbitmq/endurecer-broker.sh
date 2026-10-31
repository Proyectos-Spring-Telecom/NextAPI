#!/usr/bin/env bash
# Endurecimiento del broker (docs/contratos.md §12). Correr en springfieldDev con sudo.
#
#   sudo bash endurecer-broker.sh                 → usuarios por socket, monitoreo y topes
#   sudo bash endurecer-broker.sh --conexiones    → quién está conectado (usuario, IP, puerto)
#   sudo bash endurecer-broker.sh --retirar avl gw_panel
#                                                 → borra usuarios viejos, solo si ya nadie los usa
#
# Contraseñas: ~/rabbitmq-usuarios.env (600) con SOCK_TRACKCAM=…, SOCK_TRACKGAS=…,
# SOCK_PANEL=…, SOCK_FA100S=…, SOCK_S18=…, SENTINELA=…. Se borra al terminar.
# Nunca se imprimen. Idempotente: una segunda corrida deja todo igual.
set -euo pipefail
VH=/
CTL="rabbitmqctl -q"
CRED="${CRED:-/home/ubuntu/rabbitmq-usuarios.env}"

conexiones() {
  echo "Conexiones (usuario, IP del cliente, puerto del broker, TLS):"
  $CTL list_connections user peer_host port ssl | sort | uniq -c
}

if [[ ${1:-} == --conexiones ]]; then conexiones; exit 0; fi

if [[ ${1:-} == --retirar ]]; then
  shift
  for u in "$@"; do
    if $CTL list_connections user | grep -qx "$u"; then
      echo "NO se borra $u: tiene conexiones abiertas"; continue
    fi
    $CTL delete_user "$u" && echo "borrado $u"
  done
  exit 0
fi

[[ -r $CRED ]] || { echo "Falta $CRED"; exit 1; }
# shellcheck disable=SC1090
source "$CRED"

# Usuario con permisos mínimos. configure ^$: los sockets no declaran nada
# (checkExchange/checkQueue son pasivos y no piden permiso). write: solo el
# exchange de telemetría (datos y acks de comandos). read: solo su cola de comandos.
usuario() {
  local u=$1 pass=$2 conf=$3 write=$4 read=$5 tags=${6:-}
  [[ -n $pass ]] || { echo "Sin contraseña para $u"; exit 1; }
  if $CTL list_users | awk '{print $1}' | grep -qx "$u"; then
    $CTL change_password "$u" "$pass" >/dev/null
  else
    # Por stdin: no queda en la lista de procesos.
    printf '%s' "$pass" | $CTL add_user "$u" >/dev/null
  fi
  $CTL set_user_tags "$u" $tags
  $CTL set_permissions -p "$VH" "$u" "$conf" "$write" "$read"
  echo "usuario $u: configure=$conf write=$write read=$read tags=${tags:-ninguno}"
}

usuario sock_trackcam "${SOCK_TRACKCAM:-}" '^$' '^telemetry$' '^telemetry\.commands\.jt808$'
usuario sock_trackgas "${SOCK_TRACKGAS:-}" '^$' '^telemetry$' '^telemetry\.commands\.jimi$'
usuario sock_panel    "${SOCK_PANEL:-}"    '^$' '^telemetry$' '^telemetry\.commands\.axpro$'
usuario sock_fa100s   "${SOCK_FA100S:-}"   '^$' '^telemetry$' '^telemetry\.commands\.fa100s$'
usuario sock_s18      "${SOCK_S18:-}"      '^$' '^telemetry$' '^telemetry\.commands\.s18$'
# Solo lectura del API de administración (vigía): sin permisos AMQP.
usuario sentinela     "${SENTINELA:-}"     '^$' '^$' '^$' monitoring

# Topes. Una sola política aplica por cola: los patrones no se enciman.
# DLQ: guarda lo más reciente (drop-head); el vigía avisa antes de llegar.
$CTL set_policy -p "$VH" --apply-to queues --priority 10 dlq-tope '^telemetry\..+\.dlq$' \
  '{"max-length":50000,"max-length-bytes":104857600,"overflow":"drop-head"}'
# Comandos: si la cola se llena, el broker rechaza (NextAPI usa confirmaciones) y
# el comando se queda pendiente en Next en vez de perderse.
$CTL set_policy -p "$VH" --apply-to queues --priority 10 comandos-tope '^telemetry\.commands\.(jt808|jimi|axpro|fa100s|s18)$' \
  '{"max-length":10000,"overflow":"reject-publish"}'
echo "políticas:"; $CTL list_policies -p "$VH"

shred -u "$CRED" 2>/dev/null || rm -f "$CRED"
echo "Contraseñas borradas de $CRED"
conexiones
