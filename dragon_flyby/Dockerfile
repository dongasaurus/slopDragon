ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM ${BUILD_FROM}

RUN apk add --no-cache python3 py3-websockets

COPY run.sh /run.sh
COPY installer/install.py /usr/bin/dragon-flyby-install
COPY www/dragon-flyby.js /usr/share/dragon-flyby/dragon-flyby.js
RUN chmod a+x /run.sh /usr/bin/dragon-flyby-install

CMD [ "/run.sh" ]
