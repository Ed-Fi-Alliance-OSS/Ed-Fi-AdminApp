# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.
<#
.SYNOPSIS 
    Creates or updates a Keycloak user for local testing with the Ed-Fi Admin App.
.DESCRIPTION
    This script uses the Keycloak Admin CLI (kcadm.sh) to create or update a user in the specified realm. 
    By default, it creates a user with the username 'edfi-adminapp-test' and password '123' in the 'edfi' realm.
    The script authenticates to Keycloak using admin credentials provided via environment variables or defaults.
.PARAMETER Realm
    Keycloak realm name. Defaults to 'edfi'.
.PARAMETER Username
    Keycloak test username. Defaults to 'edfi-adminapp-test'.
.PARAMETER Password
    Keycloak test user password. Defaults to '123'.
.EXAMPLE
# Create a user with default settings
./create-local-user-keycloak.ps1
.EXAMPLE
# Create a user in a custom realm with a specific password
./create-local-user-keycloak.ps1 -Realm myrealm -Username testuser -Password Passw0rd!
#>
param(
  [string]$Realm = 'edfi',
  [string]$Username = 'edfi-adminapp-test',
  [string]$Password = '123'
)

if (-not $env:OIDC_ADMIN_USER) {
  $env:OIDC_ADMIN_USER = 'admin'
}
if (-not $env:OIDC_ADMIN_PASSWORD) {
  $env:OIDC_ADMIN_PASSWORD = 'admin'
}

docker exec $kcContainer /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080/auth --realm master --user $env:OIDC_ADMIN_USER --password $env:OIDC_ADMIN_PASSWORD --config $kcadmConfigPath
if ($LASTEXITCODE -ne 0) { throw 'Unable to authenticate to Keycloak with kcadm.' }
$existingScopesJson = & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get client-scopes -r $Realm --config $kcadmConfigPath
if ($LASTEXITCODE -ne 0) { throw 'Unable to query Keycloak client scopes.' }
$existingScopes = @()
if ($existingScopesJson) {
    $existingScopes = $existingScopesJson | ConvertFrom-Json
}

docker exec $kcContainer /opt/keycloak/bin/kcadm.sh create users \
  -r $Realm \
  -s username=$Username \
  -s firstName=EdFi \
  -s lastName=Admin \
  -s email=admin@example.com \
  -s enabled=true

# By default, the user is created without a password. Use the `set-password` command to assign one:
docker exec $kcContainer /opt/keycloak/bin/kcadm.sh set-password \
  -r $Realm \
  --username $Username \
  --new-password $Password \
  --temporary