import fs from 'fs';
import PlyrStreamThumbs from 'plyr-stream-thumbs';

// Cloudflare example stream ID, exporting 1 frame per 50secs
const id = '5d5bc37ffcf54c9b82e996823bffbb81';
const options = { secondsPerFrame: 50, maxSquare: 800 };

// given an id and {options}
// - each format returns multiple file buffers
// - be careful this example writes to disk!
PlyrStreamThumbs(id, options)
.then(formats => formats.forEach(format =>
  format.content.forEach(item =>
    fs.writeFileSync(item.name, item.data))));