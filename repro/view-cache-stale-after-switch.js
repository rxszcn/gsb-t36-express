'use strict';
// usage: node p3_view_cache_stale.js <express-root>
const express = require(process.argv[2] || "../");
const fs = require('node:fs');
const http = require('node:http');

const base = '/tmp/pxp-view';
fs.rmSync(base, { recursive: true, force: true });
fs.mkdirSync(base + '/v1', { recursive: true });
fs.mkdirSync(base + '/v2', { recursive: true });
fs.writeFileSync(base + '/v1/page.html', 'FROM-V1');
fs.writeFileSync(base + '/v2/page.html', 'FROM-V2');

function mkApp(cache) {
  const app = express();
  app.disable('x-powered-by');
  app.set('views', base + '/v1');
  app.set('view engine', 'html');
  app.set('view cache', cache);
  let engineCalls = 0;
  app.engine('html', function (p, opts, cb) { engineCalls++; cb(null, 'ENGINE-A(path-was=' + p + ')'); });
  app.get('/render', function (req, res) { res.render('page'); });
  app.get('/switch', function (req, res) {
    // re-register engine that reads the file, and move the views root
    app.engine('html', function (p, opts, cb) { engineCalls++; cb(null, 'ENGINE-B(' + fs.readFileSync(p, 'utf8') + ')'); });
    app.set('views', base + '/v2');
    res.render('page');
  });
  app.get('/calls', function (req, res) { res.send(String(engineCalls)); });
  return app;
}

function run(label, cache, cb) {
  const app = mkApp(cache);
  const srv = http.createServer(app).listen(0, '127.0.0.1', () => {
    const port = srv.address().port;
    const get = (p, done) => http.get({ port, path: p }, r => {
      let b = ''; r.on('data', d => { b += d; }); r.on('end', () => { console.log(label, p, '=>', JSON.stringify(b)); done(); });
    });
    get('/render', () => get('/switch', () => get('/render', () => get('/calls', () => { srv.close(); cb(); }))));
  });
}

run('[cache=on ]', true, () => run('[cache=off]', false, () => {}));
