## codem-transcode 0.5.0 (xxxx/yy/zz) ##

*   All fixes/features from the betas.
*   Use async package for some of the complex callback chains.
*   Ability to capture thumbnails from the videos after transcoding.

## codem-transcode 0.5.0-beta.4 (2013/04/30) ##

*   Fix for #15, cannot open database when using default config.
*   sqlite3 dependency updated to 2.1.7.

## codem-transcode 0.5.0-beta.3 (2013/04/25) ##

*   Allow purging of old successful jobs. See README for usage.
*   Tested against Node.js 0.10.

## codem-transcode 0.5.0-beta.2 (2013/03/07) ##

*   Switch to Sequelize for database abstraction. codem-transcode now supports SQLite, MySQL and Postgres. PLEASE NOTE
    that this change is *not* backwards compatible. You will need to update your database. If you are coming from an old
    version of codem-transcode we advise you to move away your old database and let the software generate a new database
    for you.
    
## codem-transcode 0.5.0-beta.1 (2013/02/19) ##

*   The logging system should now be more able to handle unexpected issues, such as when your logging file system is out
    of space. In most cases the system should be able to gracefully intercept any issues and resume operation after the
    issue has been cleared (ie. more space has been created).

## codem-transcode 0.4.4 (2013/01/28) ##

*   Use a "=" instead of a "LIKE" when loading a job. Prevents excessive disk IO.

## codem-transcode 0.4.3 (2013/01/22) ##

*   Allow both time formats in the ffmpeg output parsing (xx:xx and xx:xx:xx).

## codem-transcode 0.4.2 (2013/01/07) ##

*   Fix for copying a file across partitions.

## codem-transcode 0.4.1 (2012/10/16) ##

*   Added ffprobe support.

## codem-transcode 0.4.0 (2012/10/10) ##

*   Updated package to Node 0.8.

## codem-transcode 0.3.1 (2012/06/27) ##

*   Allow disabling of scratch directory.

## codem-transcode 0.3.0 (2012/03/20) ##

*   Updated dependency to a newer version of Node.
*   Update ffmpeg time parsing.
*   Switched from connect to express.

## codem-transcode 0.2.1 (2011/09/26) ##

*   Add additional "X-Codem-Notify-Timestamp" HTTP header.

## codem-transcode 0.2.0 (2011/08/23) ##

*   Deleting and cancelling jobs.
*   Additional error checking.

## codem-transcode 0.1.2 (2011/07/11) ##

*   Additional logging.
*   Notify when duration is known.
*   Added extra check when creating directories.

## codem-transcode 0.1.1 (2011/05/24) ##

*   Fixed license info

## codem-transcode 0.1.0 (2011/05/24) ##

*   Initial release