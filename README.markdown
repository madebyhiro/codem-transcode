# Codem-transcode

* http://github.com/madebyhiro/codem-transcode

## Description

Codem-transcode is an offline video transcoder written in node.js. It

1. Uses ffmpeg for transcoding
2. Has a simple HTTP API
3. Is mostly asynchronous

Codem-transcode can be used in conjunction with Codem-schedule (https://github.com/madebyhiro/codem-schedule) for robust job scheduling and notifications or it can be used stand-alone, with or without a custom scheduler.

## Requirements

* ffmpeg (at least 0.10 and compiled/configured to your own taste)
* sqlite3/MySQL/PostgreSQL
* node.js version 0.8.x (x>=11), with packages (if you use npm they will be installed automatically):
    * sequelize (http://sequelizejs.com/)
    * sqlite3 (http://github.com/developmentseed/node-sqlite3)
    * express (http://expressjs.com/)
    * argsparser (http://github.com/kof/node-argsparser)
    * mkdirp (https://github.com/substack/node-mkdirp)
    * async (https://github.com/caolan/async)

## Installation

The recommended installation procedure is to just use `npm` (http://npmjs.org/):

    # npm install codem-transcode

Install it to your preferred location, or use the `-g` option to install it globally.

## Upgrading

Upgrading should most of the times be as simple as shutting down, installing the new package and restarting the transcoder. Unless you're...

### Upgrading from earlier versions to 0.5 (IMPORTANT!)

Codem-transcode switched from using "plain" SQL (using sqlite) to a database abstraction layer (Sequelize). This brings some advantages
(support for multiple database engines, better consistency, easier migrations in the future), but is not backwards compatible. Therefore, we recommend you backup and move away your old database and
start with a fresh one. The procedure for this would be:

*   Shutdown the transcoder;
*   Move your database away (or delete if you're not interested in the history);
*   Install the new package;
*   Start the transcoder.

This will initialize a new up-to-date database which can be migrated to newer schema's more easily in the future. If you are doing a
clean install you do not need to worry about any of this.

If you want to keep your history we recommend you follow the above procedure and write a separate import script to import your old data
into the new database.

## Starting

When you install codem-transcode a script will be installed that allows you to start the transcoder. If you install it globally it should be in your `PATH`, otherwise, you can start the transcoder using:

    # /PATH/TO/TRANSCODER/bin/codem-transcode
    
Please check for yourself where `npm` installs your packages and script.

## Configuration

Configuration is done by specifying a CLI option (`-c`) and pointing to a file containing a valid JSON object (http://www.json.org/). Note that node.js' JSON parser is fairly strict so make sure you get the syntax right. An example config is:

    {
        "port":            8080,
        "access_log":      "/var/log/access_log",
        "database":        "/var/db/jobs.db",
        "slots":           8,
        "interface":       "127.0.0.1",
        "encoder":         "ffmpeg",
        "scratch_dir":     "/tmp",
        "use_scratch_dir": true,
        "ffprobe":         null
    }

Configuration options:

* `port`; port to start server on, default `8080`
* `interface`; which network interface to listen on, default `127.0.0.1` (only `localhost`)
* `access_log`; location to store HTTP access log, default `/var/log/access_log`
* `database`; location to store the jobs database, default is SQLite with `/var/db/jobs.db`
* `slots`; number of transcoding slots to use (i.e. the maximum number of ffmpeg child processes), defaults to the number of CPUs/cores in your machine
* `encoder`; path to the ffmpeg binary, if it is in your path specifying only `ffmpeg` is sufficient, defaults to `ffmpeg`
* `scratch_dir`; temporary files are written here and moved into the destination directory after transcoding, defaults to `/tmp`
* `use_scratch_dir`; if set to false temporary files will be written to the output directory of your job, for setups that don't require or are not able to use a separate `scratch_dir`. Defaults to `true` so if you don't want to disable the `scratch_dir` you can also omit this option from your config file.
* `ffprobe`; path to the ffprobe binary, if it is in your path specifying only `ffprobe` is sufficient, defaults to `null`. Set this to a non-null value if you want to enable ffprobe support in the transcoder.

Note that the default config will put the access_log and job database in `/var/log` and `var/db/` respectively. If you wish to put these in a different location please supply your own config. You can start the transcoder with your custom config using:

    # /PATH/TO/TRANSCODER/bin/codem-transcode -c /PATH/TO/CONFIG/config.json

### Advanced database configuration

codem-transcode supports multiple database backends, courtesy of Sequelize. The default is still to store data in a SQLite database (whenever you specify a string for `database` in the config file). To use MySQL or Postgres, supply a valid object for the database entry. Your configuration will then look like:

    {
        "port":            8080,
        "access_log":      "/var/log/access_log",
        "database":        {
            "dialect": "mysql",
            "username": "root",        
            "database": "codem",
            "host": "localhost",
            "port": 3306
        },
        "slots":           8,
        "interface":       "127.0.0.1",
        "encoder":         "ffmpeg",
        "scratch_dir":     "/tmp",
        "use_scratch_dir": true,
        "ffprobe":         null
    }

Be sure to specify a `dialect` ("mysql", "postgres", "sqlite"), a `username`, a `password` (can be omitted if using a passwordless database) and a `host` (can be omitted for "localhost"). `port` can be omitted for the default port.

## Usage

After starting the server you can control it using most HTTP CLI tools, such as `curl` or `wget`. The HTTP API is as follows:

* * *
Request: `POST /jobs`

Parameters (HTTP POST data, should be valid JSON object):

    {
        "source_file": "/PATH/TO/INPUT/FILE.wmv",
        "destination_file":"/PATH/TO/OUTPUT/FILE.mp4",
        "encoder_options": "-acodec libfaac -ab 96k -ar 44100 -vcodec libx264 -vb 416k -s 320x180 -y -threads 0",
        "thumbnail_options": {
            "percentages": [0.25, 0.5, 0.75],
            "size": "160x90",
            "format": "png"
        },
        "segments_options" : {
          "segment_time": 10
        },
        "callback_urls": ["http://example.com/notifications"]
    }

Responses:

* `202 Accepted` - Job accepted
* `400 Bad Request` - Invalid request (format)
* `503 Service Unavailable` - Transcoder not accepting jobs at the moment (all encoding slots are in use)


Required options are `source_file`, `destination_file` and `encoder_options`. Input and output files must be *absolute* paths.

The `callback_urls` array is optional and is a list (array) of HTTP endpoints that should be notified once encoding finishes (due to the job being complete or some error condition). The notification will sent using HTTP PUT to the specified endpoints with the job status. It will also include a custom HTTP header "X-Codem-Notify-Timestamp" that contains the timestamp (in milliseconds) at which the notification was generated and sent. It is best to observe this header to determine the order in which notifications are received at the other end due to network lag or other circumstances that may cause notifications to be received out of order.

The `thumbnail_options` object is optional and contains a set of thumbnails that should be encoded after the transcoding is complete. Thumbnails are captured from the source file for maximum quality. The options for thumbnails include:

* Either "percentages" or "seconds" (but not both at the same time), valid options are:
    * A single percentage, this will trigger a thumbnail every x%. `"percentages": 0.1` will generate thumbnails at 0%, 10%, 20%, [...], 100%.
    * An array of explicit percentages, this will trigger thumbnails only at the specified positions.
      `"percentages": [0.25, 0.5, 0.75]` will generate thumbnails at 25%, 50% and 75%.
    * A single offset in seconds, this will trigger a thumbnail every x seconds. `"seconds": 10` will generate thumbnails at 0 seconds, 10 seconds, 20 seconds, etc., until the end of the source file.
    * An array of explicit offsets, this will trigger thumbnails only at the specified positions.
      `"seconds": [30, 60, 90]` will generate thumbnails at 30 seconds, 60 seconds and 90 seconds.
* A size can be specified in pixels (width x height). If omitted it will generate thumbnails the size of the source video. (optional)
* A format for the thumbnails. The format must be supported by your ffmpeg binary. If omitted it will generate thumbnails in the JPEG format. Most people will use either "jpg" or "png". (optional)

If you specify thumbnails but an error occurs during generation, your job will be marked as failed. If you don't specify a valid `seconds` or `percentages` option thumbnail generation will be skipped but the job can still be completed successfully.

The `segments_options` object is optional and contains segment time (duration) in seconds. Segmented videos are used in [HLS](https://en.wikipedia.org/wiki/HTTP_Live_Streaming). These options are applied to the encoded video, thus `encoder_options` are required. Moreover `encoder_options` should prepare video for segmenting, because bitstream
filter [h264_mp4toannexb](https://www.ffmpeg.org/ffmpeg-bitstream-filters.html#h264_005fmp4toannexb) will be applied to the video. Therefore it is recommended to transcode to an MP4 file before segmenting.

The segmenting command looks like:

    ffmpeg -i /tmp/46ee0a404a4b75d85c09d98a7c6b403579ee9f99.mp4 -codec copy -map 0 \
      -f segment -vbsf h264_mp4toannexb -flags -global_header -segment_format mpegts \
      -segment_list /path/to/dest_file_dir/dest_file_name.m3u8 -segment_time 10 \
      /path/to/dest_file_dir/dest_file_name-%06d.ts

`46ee0a404a4b75d85c09d98a7c6b403579ee9f99.mp4` is a temporary encoded file (generated by Codem). After transcoding and segmenting you end up with the transcoded file, as well as the segments/playlist.

### Thumbnail-only job

It's possible to only generate thumbnails from a video and not do any transcoding at all. This might come in handy if you're transcoding to lots of different formats and want to keep thumbnail generation separate from transcoding. You achieve this by POSTing a job with `"encoder_options": ""` (empty string) and of course specifying your `thumbnail_options`. In this case `destination_file` should be a _prefix_ for the output file, e.g. `"destination_file": "/Users/codem/output/my_video"` results in thumbnails in `/Users/codem/output/` with filenames such as `my_video-$offset.$format` (where `$offset` is the thumbnail offset in the video and `$format` of course the thumbnail format). All other options remain the same. See the examples.

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
Request: `DELETE /jobs/$JOB_ID`

Cancels the job (if it is running) and deletes it from the database.

Responses:

* `200 OK` - Returns last known status of the job that is being deleted
* `404 Not Found` - Job not found

* * *
Request: `DELETE /jobs/purge/$AGE`

Purge successfully completed jobs from the database with a certain age. Age is specified in seconds since it was created. So an age of 3600 deletes jobs that were successful and created more than 1 hour ago.

Responses:

* `200 OK` - Returns number of jobs that were purged.

* * *
Request: `POST /probe`

Probe a source file using `ffprobe` (if you have enabled it in the configuration). Output is a JSON object containing the `ffprobe` output.

Parameters (HTTP POST data, should be valid JSON object):

    {
        "source_file": "/PATH/TO/INPUT/FILE.wmv"
    }

Responses:

* `200 OK` - Returns `ffprobe` output JSON-formatted
* `400 Bad Request` - Returned if you attempt to probe a file when there is no path set to the `ffprobe` binary
* `500 Internal Server Error` - Returned if there was an error while trying to probe, the output from `ffprobe` will be returned as well

* * *
## Examples

Create a new job, transcode "video.wmv" to "video.mp4" using the specified ffmpeg options (96kbit/s audio, 416kbit/s video, 320x180, use as much threads as possible). Requires libx264 support in your ffmpeg.

    # curl -d '{"source_file": "/tmp/video.wmv","destination_file":"/tmp/video.mp4","encoder_options": "-acodec libfaac -ab 96k -ar 44100 -vcodec libx264 -vb 416k -s 320x180 -y -threads 0"}' http://localhost:8080/jobs

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
    
    Output: {"id":"da56da6012bda2ce775fa028f056873bcb29cb3b", "status":"processing", "progress":0.21800947867298578, "duration":633, "filesize":39191346, "opts":"{\"source_file\":\"/shared/videos/asf/video.asf\", \"destination_file\":\"/shared/videos/mp4/journaal.mp4\", \"encoder_options\":\"-acodec libfaac -ab 96k -ar 44100 -vcodec libx264 -vb 416k -s 320x180 -y -threads 0\"}", "message":null, "created_at":1304338160, "updated_at":1304338173}

Probe a file using `ffprobe`.

    # curl -d '{"source_file": "/tmp/video.wmv"}' http://localhost:8080/probe
    
    Output: {"ffprobe":{"streams":[ ... stream info ... ],"format":{ ... format info ... }}}}
    
Thumbnail-only job (160x90 in PNG format every 10% of the video).

    # curl -d '{"source_file": "/tmp/video.mp4","destination_file":"/tmp/thumbnails/video","encoder_options": "", "thumbnail_options": { "percentages": 0.1, "size": "160x90", "format": "png"} }' http://localhost:8080/jobs

    Output: {"message":"The transcoder accepted your job.","job_id":"d4b1dfebe6860839b2c21b70f35938d870011682"}
    

Segmenting job.

    # curl -d '{"source_file": "/tmp/video.mp4", "destination_file": "/tmp/output/test.mp4", "encoder_options": "-vb 2000k -minrate 2000k -maxrate 2000k -bufsize 2000k -s 1280x720 -acodec aac -strict -2 -ab 192000 -ar 44100 -ac 2 -vcodec libx264 -movflags faststart", "segments_options": {"segment_time": 10} }' http://localhost:8080/jobs

    Output: {"message":"The transcoder accepted your job.","job_id":"7dc3c268783d7f3c737f3a134ccf1d4f15bb8442"}

    Status of finished job:

    # curl http://localhost:8080/jobs/7dc3c268783d7f3c737f3a134ccf1d4f15bb8442

    Output:
    {
      "id": "7dc3c268783d7f3c737f3a134ccf1d4f15bb8442",
      "status": "success",
      "progress": 1,
      "duration": 1,
      "filesize": 783373,
      "message": "ffmpeg finished succesfully.",
      "playlist": "/tmp/output/test.m3u8",
      "segments": [
        "/tmp/output/test-000000.ts",
        "/tmp/output/test-000001.ts",
        "/tmp/output/test-000002.ts",
        "/tmp/output/test-000003.ts",
        "/tmp/output/test-000004.ts",
        "/tmp/output/test-000005.ts"
      ]
    }

Segmenting-only job (you are expected to have a valid MP4 file suitable for segmenting as the input).

    # curl -d '{"source_file": "/tmp/video.mp4","destination_file":"/tmp/segments/video.mp4","encoder_options": "", "segments_options": {"segment_time": 10} }' http://localhost:8080/jobs

    Output: {"message":"The transcoder accepted your job.","job_id":"c7599790527c0bb173cc7a0c44411aaca5c1550a"}

    Status of finished job:
    
    # curl http://localhost:8080/jobs/c7599790527c0bb173cc7a0c44411aaca5c1550a
    
    Output:
    {
      "id":"c7599790527c0bb173cc7a0c44411aaca5c1550a",
      "status":"success",
      "progress":1,
      "duration":26,
      "filesize":6734045,
      "message":"finished segmenting job.",
      "playlist":"/tmp/segments/video.m3u8",
      "segments":[
        "/tmp/segments/video-000000.ts",
        "/tmp/segments/video-000001.ts",
        "/tmp/segments/video-000002.ts"
      ]
    }
## Issues and support

If you run into any issues while using codem-transcode please use the Github issue tracker to see if it is a known problem
or report it as a new one.

We also provide commercial support for codem-transcode (for bugs, features, configuration, etc.). If you are interested in
commercial support or are already receiving commercial support, feel free to contact us directly at hello@madebyhiro.com.

## License

Codem-transcode is released under the MIT license, see `LICENSE.txt`.
