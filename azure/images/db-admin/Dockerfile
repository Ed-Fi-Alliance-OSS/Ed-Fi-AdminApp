# Thin wrapper to embed bootstrap.sh for Azure Container Apps
# (replaces Docker Compose bind mount of bootstrap.sh to /docker-entrypoint-initdb.d/)
ARG ADMIN_DB_TAG=pre
FROM edfialliance/ods-admin-api-db:${ADMIN_DB_TAG}
COPY bootstrap.sh /docker-entrypoint-initdb.d/2-bootstrap.sh
