#!/bin/bash
set -e

/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080/auth --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" --config /tmp/mykcadm.config

/opt/keycloak/bin/kcadm.sh get realms/edfi --config /tmp/mykcadm.config && echo "[healthcheck] edfi realm is available" || echo "[healthcheck] edfi realm is NOT available" >&2
