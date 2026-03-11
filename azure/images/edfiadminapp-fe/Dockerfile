# Thin wrapper to embed nginx.conf for the frontend container
# The FE Dockerfile expects nginx.conf to be bind-mounted; this bakes it in for ACA
ARG FE_IMAGE=edfialliance/adminapp-fe:pre
FROM ${FE_IMAGE}
COPY nginx.conf /etc/nginx/nginx.conf
