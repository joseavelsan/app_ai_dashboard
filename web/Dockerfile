FROM nginx:1.27-alpine

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

RUN rm -rf /usr/share/nginx/html/.git \
    /usr/share/nginx/html/.claude \
    /usr/share/nginx/html/api \
    /usr/share/nginx/html/web
