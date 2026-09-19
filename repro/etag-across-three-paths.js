'use strict';
// 探针：app.set('etag', ...) 在 res.send / res.sendFile / express.static 三条路径上是否一致
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('..');

const dir = '/tmp/ex6static';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'a.txt'), 'hello world');

function build(mode) {
  const app = express();
  if (mode === 'strong') app.set('etag', 'strong');
  if (mode === 'off') app.disable('etag');
  app.get('/send', (req, res) => res.send('hello world'));
  app.get('/sendfile', (req, res) => res.sendFile(path.join(dir, 'a.txt')));
  app.use('/static', express.static(dir));
  return app;
}

function probe(server, pathName) {
  return new Promise(function (resolve) {
    const port = server.address().port;
    http.get({ port: port, path: pathName }, function (res) {
      res.resume();
      res.on('end', function () {
        console.log('   ', pathName.padEnd(12), 'ETag =', JSON.stringify(res.headers.etag));
        resolve();
      });
    });
  });
}

(async function () {
  for (const mode of ['default', 'strong', 'off']) {
    const server = build(mode).listen(0);
    await new Promise(r => server.once('listening', r));
    console.log('== app etag 配置: ' + mode + '  (body 同为 "hello world") ==');
    await probe(server, '/send');
    await probe(server, '/sendfile');
    await probe(server, '/static/a.txt');
    server.close();
  }
})();
