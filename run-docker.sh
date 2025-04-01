#!/bin/zsh

EA_CODE_PATH_DEFAULT=~/code
KEYCLOAK_FOLDER_NAME_DEFAULT=keycloak_local_idp_se
SBAA_FOLDER_NAME_DEFAULT=startingblocks_admin_app

echo "You can set the following environment variables to customize the script:"
echo "EA_CODE_PATH: The path to the code folder. Default is $EA_CODE_PATH_DEFAULT"
echo "KEYCLOAK_FOLDER_NAME: The name of the keycloak folder. Default is $KEYCLOAK_FOLDER_NAME_DEFAULT"
echo "SBAA_FOLDER_NAME: The name of the starting blocks admin app folder. Default is $SBAA_FOLDER_NAME_DEFAULT"
echo ""

if [[ -z "$EA_CODE_PATH" ]]; then
  echo "EA_CODE_PATH not set, using default of $EA_CODE_PATH_DEFAULT"
  EA_CODE_PATH=$EA_CODE_PATH_DEFAULT
fi

if [[ -z "$KEYCLOAK_FOLDER_NAME" ]]; then
  echo "KEYCLOAK_FOLDER_NAME not set, using default of $KEYCLOAK_FOLDER_NAME_DEFAULT"
  KEYCLOAK_FOLDER_NAME=$KEYCLOAK_FOLDER_NAME_DEFAULT
fi

if [[ -z "$SBAA_FOLDER_NAME" ]]; then
  echo "SBAA_FOLDER_NAME not set, using default of $SBAA_FOLDER_NAME_DEFAULT"
  SBAA_FOLDER_NAME=$SBAA_FOLDER_NAME_DEFAULT
fi

keycloakPath="$EA_CODE_PATH/$KEYCLOAK_FOLDER_NAME"
sbaaPath="$EA_CODE_PATH/$SBAA_FOLDER_NAME"
echo $keycloakPath
echo $sbaaPath

cd $keycloakPath
docker compose -f $keycloakPath/docker-compose.yml up &
cd $sbaaPath
docker compose -f $sbaaPath/docker-compose.yml up
