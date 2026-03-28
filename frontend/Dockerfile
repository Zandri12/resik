# Build React (VITE_* harus tersedia saat npm run build)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_BACKEND_URL=""
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

ARG VITE_LOGIN_HERO_IMAGE=""
ENV VITE_LOGIN_HERO_IMAGE=$VITE_LOGIN_HERO_IMAGE

ARG VITE_CONTACT_EMAIL=""
ENV VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL

ARG VITE_CONTACT_URL=""
ENV VITE_CONTACT_URL=$VITE_CONTACT_URL

RUN npm run build

FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
