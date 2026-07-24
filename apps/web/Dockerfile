FROM node:20-alpine AS build
WORKDIR /app
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
ARG VITE_API_URL=http://localhost:4001/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
