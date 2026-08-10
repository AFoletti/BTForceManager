# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ .

# Left empty on purpose: the nginx stage below proxies /api/* to the backend
# container, so the bundle should call relative "/api/..." paths and work
# regardless of what hostname/IP/port the NAS is reached on. Only override
# this at build time if the frontend is deployed separately from the backend
# (e.g. --build-arg REACT_APP_BACKEND_URL=https://your-backend-host:8000).
ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN yarn build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
