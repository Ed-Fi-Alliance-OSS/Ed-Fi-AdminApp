#!/bin/zsh

keycloakFolder=~/code/keycloak_local_idp_se
sbaaFolder=~/code/startingblocks_admin_app

cd $keycloakFolder
docker compose -f $keycloakFolder/docker-compose.yml up &
cd $sbaaFolder
docker compose -f $sbaaFolder/docker-compose.yml up
