FROM mhart/alpine-node:6
MAINTAINER lars.fischer@ecruos.de
WORKDIR /var/local/
ADD codem-transcode codem-transcode
WORKDIR /var/local/codem-transcode
ADD config.override.json config.override.json
RUN apk update
RUN apk upgrade
RUN apk add sqlite
RUN apk add bash
RUN apk add ffmpeg
RUN npm install
ENTRYPOINT ["node", "bin/codem-transcode.js", "-c", "config.override.json"]
EXPOSE 8080