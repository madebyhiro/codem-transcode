# Codem-transcode

* https://github.com/madebyhiro/codem-transcode

## Description

`codem-transcode` is an offline video transcoder written in node.js. It

1. Uses FFmpeg for transcoding
2. Has a simple HTTP API
3. Is mostly asynchronous

`codem-transcode` can be used in conjunction with `codem-schedule` (https://github.com/madebyhiro/codem-schedule) for robust job scheduling and notifications or it can be used stand-alone, with or without a custom scheduler.

## Requirements

* NodeJS 6.4.0 or higher

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
      logLevel: 'info'
      storageBackend: { 'type': 'memory' }
      slots: number of available CPU's

* `address`: the interface to bind the server to, defaults to `127.0.0.1` so local access to the server only.
* `port`: the port to start the server on, defaults to `8080`.
* `logLevel`: the level of detail in the logs, defaults to `info`. Valid options are `trace`, `debug`, `info`, `warn` and `error`. You normally want to keep this on `info`.
* `storageBackend`: the storage backend to use for your jobs. Currently, only one option exists, an in-memory cache. (TBD: Redis and MySQL)
* `slots`: the number of jobs that can be processed simultaneously. This can be tuned to your own setup and defaults to the number of logical cores in your machine.

## Usage

TBD

## Examples

TBD

## Issues and support

If you run into any issues while using `codem-transcode` please use the Github issue tracker to see if it is a known problem
or report it as a new one.

We also provide commercial support for `codem-transcode` (for bugs, features, configuration, etc.). If you are interested in
commercial support or are already receiving commercial support, feel free to contact us directly at hello@madebyhiro.com.

## License

`codem-transcode` is released under the MIT license, see `LICENSE.txt`.