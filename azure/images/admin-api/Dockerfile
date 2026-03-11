# Thin wrapper to embed log4net config for Azure Container Apps
# Used by v6-adminapi and v7-single-adminapi
ARG ADMIN_API_TAG=pre
FROM edfialliance/ods-admin-api:${ADMIN_API_TAG}
COPY log4net.config /app/log4net/log4net.config
