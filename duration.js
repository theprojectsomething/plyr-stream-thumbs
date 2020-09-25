import m3u8 from 'm3u8';
import https from 'https';

const url = (id, endpoint) => `https://videodelivery.net/${id}/manifest/${endpoint || 'video.m3u8'}`;

const parse = (id, endpoint) => new Promise((resolve, reject) => {
  https.get(url(id, endpoint), e =>
    e.statusCode === 200 ? e.pipe(parser) : reject(e.statusCode))
  .on('error', e => reject(e.message));

  const parser = m3u8.createStream();
  parser.on('m3u', (m3u) => resolve(m3u));
});

export default id =>
  parse(id)
  .then(e => parse(id, e.items.StreamItem[0].properties.uri))
  .then(e => e.items.PlaylistItem.reduce((_, i) => _ + i.properties.duration, 0))
  .catch(e => console.log(e));