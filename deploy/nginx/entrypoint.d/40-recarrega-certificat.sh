#!/bin/sh
# acme.sh renova el certificat dins del volum `certs`, però no pot recarregar aquest contenidor.
# Nginx el torna a llegir cada 6 hores; Let's Encrypt renova amb 30 dies de marge.
set -eu
(while sleep 21600; do nginx -s reload; done) &
