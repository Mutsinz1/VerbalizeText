# The project is static — there is nothing to build, so nginx just serves it.
FROM nginx:1.27-alpine

COPY docker/default.conf /etc/nginx/conf.d/default.conf

COPY index.html style.css lib.js script.js /usr/share/nginx/html/
COPY img /usr/share/nginx/html/img

EXPOSE 80
