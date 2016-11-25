# Codem-transcode

* https://github.com/madebyhiro/codem-transcode

## Description

`codem-transcode` is an offline video transcoder written in Node.js. It

1. Uses FFmpeg for transcoding by default, but can be extended to use different backends
2. Has a simple HTTP API
3. Is mostly asynchronous

`codem-transcode` can be used in conjunction with `codem-schedule` (https://github.com/madebyhiro/codem-schedule) for job scheduling and notifications, with a custom scheduler or even stand-alone.

## Requirements

* Node.js 6.4.0 or higher

## Installation

The recommended installation procedure is to just use `npm` (https://www.npmjs.com):

    # npm install codem-transcode

Install it to your preferred location, or use the `-g` option to install it globally.

## Starting

When you install `codem-transcode` a script will be installed that allows you to start the transcoder. If you install it globally it should be in your `PATH`, otherwise, you can start the transcoder using:

    # /PATH/TO/TRANSCODER/bin/codem-transcode
    
Please check for yourself where `npm` installs your packages and script.

## Configuration

`codem-transcode` accepts a config file if you wish to change the default settings. The config file is specified using the `-c` option in the CLI. To see the defaults and options, run:

    # /PATH/TO/TRANSCODER/bin/codem-transcode -h
    usage: codem-transcode [arguments]

    arguments:
      -c --config        Specify the config file to use. Must be a valid JSON object.
                         If not specified the default config will be used (listed below).
      -h --help          Print this list and exit.

    default config:
      address: '127.0.0.1'
      port: 8080
      logFile: standard out default, specify file path if you want to log to file
      logLevel: 'info'
      storageBackend: { 'type': 'memory' }
      slots: number of available CPU's

* `address`: the interface to bind the server to, defaults to `127.0.0.1` so local access to the server only.
* `port`: the port to start the server on, defaults to `8080`.
* `logLevel`: the level of detail in the logs, defaults to `info`. Valid options are `trace`, `debug`, `info`, `warn` and `error`. You normally want to keep this on `info`.
* `storageBackend`: the storage backend to use for your jobs. Currently, only one option exists, an in-memory cache. (TBD: Redis and MySQL)
* `slots`: the number of jobs that can be processed simultaneously. This can be tuned to your own setup and defaults to the number of logical cores in your machine.

## Usage

`codem-transcode` works by sending jobs to the transcoder via HTTP POST and retrieving their status either by HTTP GET or a callback notification once the job finishes processing. The basic form of submitting a new job is:

`curl -H "Content-Type: application/json" -d'{ options: { ... }, callbackURLs: [ ... ] }' http://localhost:8080/jobs`

The preferred way of submitting is by supplying a JSON object (remember to set the `Content-Type` header correctly) containing an `options` key (mandatory) and a list of `callbackURLs` to be notified (using HTTP PUT) whenever the job is finished (optional).

What constitutes valid options is determined by the processing backend (currently always `codem-ffmpeg`, but can be extended to include other backends for other utilities as well).

## API

Please note that the status codes listed below are not exhaustive: any request that results in an internal error will most likely trigger a 5xx status code.

* * *
Request: `POST /jobs`

Post a new job to the transcoder. Supply a valid JSON object in the request body and set the `Content-Type` to `application/json`.

Responses:

* `201 Created` - Job created (response includes a `Location` header where you can monitor progress)
* `503 Service Unavailable` - Transcoder not accepting jobs at the moment (all encoding slots are in use)

* * *
Request: `GET /jobs`

Get the status of all running jobs and information on the number of available slots.

Responses:

* `200 OK` - Returns status of all active jobs

* * *
Request: `GET /jobs/:id`

Get the status of a single job.

Responses:

* `200 OK` - Returns status of job
* `404 Not Found` - Job not found

* * *
Request: `DELETE /jobs/:id`

Cancels the job (if it is running).

Responses:

* `200 OK` - Returns last known status of the job that is being deleted
* `404 Not Found` - Job not found

## Examples

Create a new job, transcode "video.wmv" to "video.mp4" using the specified FFmpeg options (96kbit/s audio, 416kbit/s video, 320x180). Requires libx264 support in your ffmpeg. Returns the job that was created.

    # curl -H "Content-Type: application/json" -d'{"options": ["-i", "/tmp/video.wmv", "-acodec", "libfaac", "-ab", "96k", "-ar", "44100", "-vcodec", "libx264", "-vb", "416k", "-s", "320x180", "/tmp/video.mp4"]}' http://localhost:8080/jobs

## Issues and support

If you run into any issues while using `codem-transcode` please use the Github issue tracker to see if it is a known problem
or report it as a new one.

We also provide commercial support for `codem-transcode` (for bugs, features, configuration, etc.). If you are interested in
commercial support or are already receiving commercial support, feel free to contact us directly at hello@madebyhiro.com.

## License

`codem-transcode` is released under the MIT license, see `LICENSE.txt`.