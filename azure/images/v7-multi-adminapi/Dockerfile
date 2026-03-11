# Thin wrapper to embed appsettings template and log4net config for Azure Container Apps
ARG ADMIN_API_TAG=pre
FROM edfialliance/ods-admin-api:${ADMIN_API_TAG}
COPY appsettings.dockertemplate.json /app/appsettings.dockertemplate.json
COPY log4net.config /app/log4net/log4net.config
