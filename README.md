# Plyr Cloudflare Stream Thumbnails Generator

Generate thumbnails from Cloudflare Stream for use with [@sampotts/plyr](https://github.com/sampotts/plyr). Works in Node and the browser.

![Plyr Stream Thumbs example output](https://github.com/theprojectsomething/plyr-stream-thumbs/blob/master/5d5bc37ffcf54c9b82e996823bffbb81-00001.jpg?raw=true)

## Features
Supply a Stream ID and get sprite sheets (jpg) and a corresponding text track (VTT) back in multiple formats.

## Install
**Node/Browser**
```js
npm install plyr-stream-thumbs
```
**Node additional dependency**
```js
npm install canvas
```

## Generating thumbs
**Node example**
```js
import fs from 'fs';
import PlyrStreamThumbs from 'plyr-stream-thumbs';
// Note: @Automattic/node-canvas must be installed for use in node: npm i canvas

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
```

**Browser example**
```js
import PlyrStreamThumbs from 'plyr-stream-thumbs';

// Cloudflare example stream ID, exporting 1 frame per 50secs
const id = '5d5bc37ffcf54c9b82e996823bffbb81';
const options = { secondsPerFrame: 50, maxSquare: 800 };

// given an id and {options}
// - each format returns multiple Blobs
// - this example logs the output
PlyrStreamThumbs(id, options)
.then(formats => formats.forEach(format =>
  format.content.forEach(item =>
    console.log(item.name, item.data))));
```

## Options

**formats: _(object, array of objects)_** define output formats for e.g standard and hi-res players. Parameters (*width*, *height*, *prefix*) can also be defined directly on the options object where only one format is required. default:  
```js
[{
  prefix: '@2x',
  width: 320,
  height: 180,
}, {
  width: 144,
  height: 120,
}]
```
**width: _(number)_** width of each frame in pixels (default defined by *formats*)  
**height: _(number)_** height of each frame in pixels (default defined by *formats*)  
**prefix: _(string)_** prefix for a given format; useful where multiple formats are defined (default defined by *formats*)  
**maxSquare: _(number)_** max dimensions (width/height) of the resulting sprite sheet in pixels (default: 2000)  
**secondsPerFrame: _(number)_** seconds between each frame (smart default based on duration, minimum defined by *minSecondsPerFrame*)  
**minSecondsPerFrame: _(number)_** minimum seconds between each frame, is overidden by *secondsPerFrame* (default: 2)
