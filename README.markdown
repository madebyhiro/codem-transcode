# Codem-transcode

* https://github.com/madebyhiro/codem-transcode

## Description

`codem-transcode` is an offline video transcoder written in node.js. It

1. Uses ffmpeg for transcoding
2. Has a simple HTTP API
3. Is mostly asynchronous

`codem-transcode` can be used in conjunction with `codem-schedule` (https://github.com/madebyhiro/codem-schedule) for robust job scheduling and notifications or it can be used stand-alone, with or without a custom scheduler.

## Requirements

TBD

## Installation

The recommended installation procedure is to just use `npm` (https://www.npmjs.com):

    # npm install codem-transcode

Install it to your preferred location, or use the `-g` option to install it globally.

## Starting

When you install `codem-transcode` a script will be installed that allows you to start the transcoder. If you install it globally it should be in your `PATH`, otherwise, you can start the transcoder using:

    # /PATH/TO/TRANSCODER/bin/codem-transcode
    
Please check for yourself where `npm` installs your packages and script.

## Configuration

TBD

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