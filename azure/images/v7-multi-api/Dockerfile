# Thin wrapper to embed the appsettings template for Azure Container Apps
# (replaces Docker Compose bind mount)
ARG ODS_API_TAG=v7.3
FROM edfialliance/ods-api-web-api:${ODS_API_TAG}
COPY appsettings.dockertemplate.json /app/appsettings.dockertemplate.json
