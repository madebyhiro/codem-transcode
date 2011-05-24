# Codem-transcode

* http://github.com/NPO/codem-transcode

## Description

Codem-transcode is an offline video transcoder written in node.js. It

1. Uses ffmpeg for transcoding
2. Has a simple HTTP API
3. Is mostly asynchronous

Codem-transcode can be used in conjunction with Codem-schedule (https://github.com/NPO/codem-schedule) for robust job scheduling and notifications or it can be used stand-alone, with or without a custom scheduler.

## Requirements

* ffmpeg (compiled/configured to your own taste)
* sqlite3
* node.js version >= 0.4.x, with packages (if you use npm they will be installed automatically):
    * sqlite3 (http://github.com/developmentseed/node-sqlite3)
    * connect (http://github.com/senchalabs/Connect)
    * argsparser (http://github.com/kof/node-argsparser)
    * mkdirp (https://github.com/substack/node-mkdirp)

## Installation

The recommended installation procedure is to just use `npm` (http://npmjs.org/):

    # npm install codem-transcode

Install it to your preferred location, or use the `-g` option to install it globally.

## Starting

When you install codem-transcode a script will be installed that allows you to start the transcoder. If you install it globally it should be in your `PATH`, otherwise, you can start the transcoder using:

    # /PATH/TO/TRANSCODER/bin/codem-transcode
    
Please check for yourself where `npm` installs your packages and script.

## Configuration

Configuration is done by specifying a CLI option (`-c`) and pointing to a file containing a valid JSON object (http://www.json.org/). Note that node.js' JSON parser is fairly strict so make sure you get the syntax right. An example config is:

    {
        "port":        8080,
        "access_log":  "/var/log/access_log",
        "database":    "/var/db/jobs.db",
        "slots":       8,
        "interface":   "127.0.0.1",
        "encoder":     "ffmpeg",
        "scratch_dir": "/tmp"
    }

Configuration options:

* `port`; port to start server on, default `8080`
* `interface`; which network interface to listen on, default `127.0.0.1` (only `localhost`)
* `access_log`; location to store HTTP access log, default `/var/log/access_log`
* `database`; location to store sqlite jobs DB, default `/var/db/jobs.db`
* `slots`; number of transcoding slots to use (i.e. the maximum number of ffmpeg child processes), defaults to the number of CPUs/cores in your machine
* `encoder`; path to the ffmpeg binary, if it is in your path specifying only `ffmpeg` is sufficient, defaults to `ffmpeg`
* `scratch_dir`; temporary files are written here and moved into the destination directory after transcoding, defaults to `/tmp`

Note that the default config will put the access_log and job database in `/var/log` and `var/db/` respectively. If you wish to put these in a different location please supply your own config. You can start the transcoder with your custom config using:

    # /PATH/TO/TRANSCODER/bin/codem-transcode -c /PATH/TO/CONFIG/config.json

## Usage

After starting the server you can control it using most HTTP CLI tools, such as `curl` or `wget`. The HTTP API is as follows:

* * *
Request: `POST /jobs`

Parameters (HTTP POST data, should be valid JSON object):

    {
        "source_file": "/PATH/TO/INPUT/FILE.wmv",
        "destination_file":"/PATH/TO/OUTPUT/FILE.mp4",
        "encoder_options": "-acodec libfaac -ab 96k -ar 44100 -vcodec libx264 -vb 416k -vpre slow -vpre baseline -s 320x180 -y -threads 0",
        "callback_urls": ["http://example.com/notifications"]
    }

Responses:

* `202 Accepted` - Job accepted
* `400 Bad Request` - Invalid request (format)
* `503 Service Unavailable` - Transcoder not accepting jobs at the moment (all encoding slots are in use)

The `callback_urls` array is optional and is a list (array) of HTTP endpoints that should be notified once encoding finishes (due to the job being complete or some error condition). All other options are required (`source_file`, `destination_file` and `encoder_options`). Input and output files should be *absolute* paths.

* * *
Request: `GET /jobs`

Responses:

* `200 OK` - Returns status of all active jobs

* * *
Request: `GET /jobs/$JOB_ID`

Responses:

* `200 OK` - Returns status of job
* `404 Not Found` - Job not found

* * *
## Examples

Create a new job, transcode "video.wmv" to "video.mp4" using the specified ffmpeg options (96kbit/s audio, 416kbit/s video, 320x180, use as much threads as possible). Requires libx264 support in your ffmpeg.

    # curl -d '{"source_file": "/tmp/video.wmv","destination_file":"/tmp/video.mp4","encoder_options": "-acodec libfaac -ab 96k -ar 44100 -vcodec libx264 -vb 416k -vpre slow -vpre baseline -s 320x180 -y -threads 0"}' http://localhost:8080/jobs

    Output: {"message":"The transcoder accepted your job.","job_id":"d4b1dfebe6860839b2c21b70f35938d870011682"}
    
Create a new job, transcode "video.mpg" to "video.webm" using the specified ffmpeg options (total bitrate 512kbit/s, 320x180, use as much threads as possible). Requires libvpx support in your ffmpeg.

    # curl -d '{"source_file": "/tmp/video.mpg","destination_file":"/tmp/video.webm","encoder_options": "-vcodec libvpx -b 512000 -s 320x180 -acodec libvorbis -y -threads 0"}' http://localhost:8080/jobs

    Output: {"message":"The transcoder accepted your job.","job_id":"c26769be0955339db8f98580c212b7611cacf4dd"}
    
Get status of all available encoder slots.

    # curl http://localhost:8080/jobs

    Output: {"max_slots":8,"free_slots":8,"jobs":[]}
    
or

    Output: {"max_slots":8, "free_slots":7, "jobs":[{"id":"da56da6012bda2ce775fa028f056873bcb29cb3b", "status":"processing", "progress":0.12480252764612954, "duration":633, "filesize":39191346, "message":null}]}
    
Get full status of one job with id "da56da6012bda2ce775fa028f056873bcb29cb3b".

    # curl http://localhost:8080/jobs/da56da6012bda2ce775fa028f056873bcb29cb3b
    
    Output: {"id":"da56da6012bda2ce775fa028f056873bcb29cb3b", "status":"processing", "progress":0.21800947867298578, "duration":633, "filesize":39191346, "opts":"{\"source_file\":\"/shared/videos/asf/video.asf\", \"destination_file\":\"/shared/videos/mp4/journaal.mp4\", \"encoder_options\":\"-acodec libfaac -ab 96k -ar 44100 -vcodec libx264 -vb 416k -vpre slow -vpre baseline -s 320x180 -y -threads 0\"}", "message":null, "created_at":1304338160, "updated_at":1304338173}

## Tests

All tests are written using jasmine (via jasmine-node). Running them is as easy as:

    # jasmine-node test

More specs coming soon.

## License

Codem-transcode is released under the MIT license, see `LICENSE.txt`.