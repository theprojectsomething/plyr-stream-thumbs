import Duration from './duration.js';
const isNode = typeof self === 'undefined';

const defaultFormats = [{
  prefix: '@2x',
  width: 320,
  height: 180,
}, {
  width: 144,
  height: 120,
}];

const getCanvas = (width, height) => {
  // NODE
  if (isNode) {
    return import('canvas')
    .then(canvas => canvas.default.createCanvas(width, height))
    .catch(e => console.log('@Automattic/node-canvas is required for use in node: npm i canvas'));
  // BROWSER
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return Promise.resolve(canvas);
  }
}

// create url, parsing truthy args as params
const createUrl = (id, path, ext, args = {}) => {
  const params = Object.keys(args)
    .reduce((_, key) =>
      args[key] ? _.concat(`${key}=${args[key]}`) : _, [])
    .join('&');
  return [`https://videodelivery.net/${id}/${path}.${ext}`].concat(params || []).join('?');
};

// get a thumbnail from the cloudflare api
// animate with duration / fps
const thumbnail = (
  id,
  time, /* 8s|1h2m3s OR { time, height, ... } */
  height,
  width,
  fit, /* crop|clip|scale|fill */
  duration, /* animated only */
  fps, /* animated only*/
) => {
  const args = typeof time === 'object'
    ? time
    : { time, height, width, fit, duration, fps };
  const ext = args.duration ? 'gif' : 'jpg';
  return createUrl(id, 'thumbnails/thumbnail', ext, args);
};

const getName = (stream, prefix, page) =>
  stream.concat(prefix || '').concat(isNaN(page)
    ? '.vtt'
    : `-${('0000' + (page + 1)).slice(-5)}.jpg`);

const loadImage = (stream, time, height) => new Promise((resolve, reject) => {
  const src = thumbnail(stream, time + 's', height);
  if (isNode) {
    import('canvas')
    .then(canvas => canvas.default.loadImage(src))
    .then(img => resolve(img))
    .catch(() => reject());
  } else {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject();
    img.src = src;
  }
});

const loadImages = (stream, format) => {
  const images = [];
  for (var i = 0; i < format.frames.count; i++) {
    const time = (i + 0.5) * format.frames.secondsPer;
    images.push(loadImage(stream, time, format.height));    
  }
  return Promise.all(images);
};

const renderPage = (format, images, index = 0) => new Promise((resolve, reject) =>
  getCanvas(format.frames.across * format.width, format.height * Math.ceil(images.length / format.frames.across))
  .then((canvas) => {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 0;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const r = Math.max(format.width / images[0].naturalWidth, format.height / images[0].naturalHeight);
    const sx = Math.round((images[0].naturalWidth - (format.width / r)) / 2);
    const sy = Math.round((images[0].naturalHeight - (format.height / r)) / 2);

    for (var i = 0; i < images.length; i++) {
      const x = (i % format.frames.across) * format.width;
      const y = Math.floor(i / format.frames.across) * format.height;
      ctx.drawImage(
        images[i],
        sx, sy,
        Math.round(format.width / r),
        Math.round(format.height / r),
        x, y,
        format.width, format.height);
    }

    try {
      canvas[isNode ? 'toBuffer' : 'toBlob']((browserData, nodeData) => resolve({
        index,
        data: isNode ? nodeData : browserData,
        name: getName(format.stream, format.prefix, index),
      }), 'image/jpeg', 0.4);
    } catch (e) {
      reject(e);
    }
  }));

const renderPreview = (stream, formats, processVtt) =>
  loadImages(stream, formats[0])
  .then(images => formats.map((format) => {
    const queue = [];

    // render VTT if required
    if (processVtt) {
      const vtt = renderVtt(format);
      queue.push(vtt);
    }

    // render each preview page
    for (var i = 0; i < format.pages; i++) {
      const start = i * format.frames.perPage;
      const end = (i + 1) * format.frames.perPage;
      const page = renderPage(format, images.slice(start, end), i);
      queue.push(page);
    }

    // return all
    return Promise.all(queue)
    .then(content => ({ ...format, content }));
  }))
  .then(previews => Promise.all(previews));

const renderVtt = (format) => {
  const vtt = ['WEBVTT'];
  let timestamp = '00:00:00.000';
  for (let i = 0; i < format.frames.count; i++) {
    const tEnd = (i + 1) * format.frames.secondsPer;
    const ms = ('00' + (1000 * tEnd) % 1000).slice(-3);
    const ss = ('0' + Math.floor(tEnd % 60)).slice(-2);
    const mm = ('0' + Math.floor(tEnd / 60)).slice(-2);
    const hh = ('0' + Math.floor(tEnd / 60 / 60)).slice(-2);
    const timestampEnd = `${hh}:${mm}:${ss}.${ms}`;
    const x = (i % format.frames.across) * format.width;
    const y = (Math.floor(i / format.frames.across) % format.frames.down) * format.height;
    const page = Math.floor(i / format.frames.across / format.frames.down);
    vtt.push(`${i + 1}
${timestamp} --> ${timestampEnd}
${getName(format.stream, format.prefix, page)}#xywh=${x},${y},${format.width},${format.height}`);
    timestamp = timestampEnd;
  }
  return {
    name: getName(format.stream, format.prefix),
    data: isNode
      ? vtt.join('\n\n')
      : new Blob([vtt.join('\n\n')], { type: 'text/vtt' }),
  };
};

const getFormats = (stream, options) => {
  if (!stream) {
    Promise.reject('stream id required');
  }

  return Duration(stream).then((dur) => {
    const maxSquare = options.maxSquare || 2000;
    const minSPF = options.minSecondsPerFrame || 2; // min seconds per frame
    const secondsPer = options.secondsPerFrame || Math.max(minSPF, 1 + 0.5 * Math.floor(dur / 60));
    const count = Math.floor(dur / secondsPer);
    const formats = [].concat(options.formats || (options.width && options.height && options) || defaultFormats)
    .map((format) => {
      const frames = { count, secondsPer };
      frames.across = Math.floor(maxSquare / format.width);
      frames.down = Math.floor(maxSquare / format.height);
      frames.perPage = frames.across * frames.down;
      const pages = Math.ceil(frames.count / frames.perPage);
      return { ...format, frames, pages, dur, stream };
    });
    return formats;
  });
};

export const generatePreview = (stream, options = {}) =>
  getFormats(stream, options)
  .then(formats => renderPreview(stream, formats))
  .then(list => list.length === 1 ? list[0] : list);

export const generateVtt = (stream, options = {}) =>
  getFormats(stream, options)
  .then(formats =>
    formats.map(format =>
      ({ ...format, content: [renderVtt(format)] })))
  .then(list => list.length === 1 ? list[0] : list);

export default (stream, options = {}) =>
  getFormats(stream, options)
  .then(formats => renderPreview(stream, formats, true));