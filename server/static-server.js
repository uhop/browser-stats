// https://gist.github.com/uhop/fbb7fc3606cbb2fa54e0ce4f9a200037
// License: BSD-3
// (c) 2023 Eugene Lazutkin

import http from 'http';
import fs from 'fs';
import path from 'path';

const fsp = fs.promises;

// simple development static server with no dependencies

// default environment variables: HOST=localhost, PORT=3000, SERVER_ROOT is process.cwd()

// Recognized command-line parameters:
// --trace          --- show HTTP requests and their status
// --list           --- show directory listings, otherwise serve index.html for directories
// --show-dot-files --- show directories and files that names start with the dot (.)

// MIME source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
const mimeTable = {
    css: 'text/css',
    csv: 'text/csv',
    eot: 'application/vnd.ms-fontobject',
    gif: 'image/gif',
    html: 'text/html',
    ico: 'image/vnd.microsoft.icon',
    jpg: 'image/jpeg',
    js: 'text/javascript',
    json: 'application/json',
    otf: 'font/otf',
    png: 'image/png',
    svg: 'image/svg+xml',
    ttf: 'font/ttf',
    txt: 'text/plain',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    xml: 'application/xml'
  },
  defaultMime = 'application/octet-stream',
  rootFolder = process.env.SERVER_ROOT || process.cwd(),
  traceCalls = process.argv.includes('--trace'),
  listFolders = process.argv.includes('--list'),
  showDotFiles = process.argv.includes('--show-dot-files'),
  isTTY = process.stdout.isTTY,
  hasColors = isTTY && process.stdout.hasColors();

// common aliases
const mimeAliases = {mjs: 'js', cjs: 'js', htm: 'html', jpeg: 'jpg'};
Object.keys(mimeAliases).forEach(name => (mimeTable[name] = mimeTable[mimeAliases[name]]));

// colors to use
const join = (...args) => args.map(value => value || '').join(''),
  paint = hasColors
    ? (prefix, suffix = '\x1B[39m') =>
        text =>
          join(prefix, text, suffix)
    : () => text => text,
  grey = paint('\x1B[2;37m', '\x1B[22;39m'),
  red = paint('\x1B[41;97m', '\x1B[49;39m'),
  green = paint('\x1B[32m'),
  yellow = paint('\x1B[93m'),
  blue = paint('\x1B[44;97m', '\x1B[49;39m');

const link = hasColors ? (url, title = url) => '\x1B]8;;' + url + '\x1B\\' + title + '\x1B]8;;\x1B\\' : url => url;

// sending helpers

const sendFile = (req, res, fileName, ext, justHeaders) => {
  if (!ext) {
    ext = path.extname(fileName).toLowerCase();
  }
  let mime = ext && mimeTable[ext.substr(1)];
  if (!mime || typeof mime != 'string') {
    mime = defaultMime;
  }
  res.writeHead(200, {'Content-Type': mime});
  if (justHeaders) {
    res.end();
  } else {
    fs.createReadStream(fileName).pipe(res);
  }
  traceCalls && console.log(green('200') + ' ' + grey(req.method) + ' ' + grey(req.url));
};

const sendRedirect = (req, res, to, code = 301) => {
  res.writeHead(code, {Location: to}).end();
  traceCalls && console.log(blue(code) + ' ' + grey(req.method) + ' ' + grey(req.url));
};

const bailOut = (req, res, code = 404) => {
  res.writeHead(code).end();
  traceCalls && console.log(red(code) + ' ' + grey(req.method) + ' ' + grey(req.url));
};

////////////////////////
// listing (comment this section out to remove the functionality)

const style = `<style>
  :root { color-scheme: light dark; }
  .size { text-align: right; font-weight: bold; }
  .name { text-align: left; font-weight: bold; }
  h1, thead { font-family: Helvetica, Arial, sans-serif; }
  tbody { font-family: Courier, 'Courier New', monospace; font-size: 80%;  margin-top: 1em; }
  td, th { padding-left: 1em; }
  th { padding-bottom: 0.5em; }
</style>`;

const formatSize = size => {
  const s = String(size);
  if (s.length <= 3) return s;
  const parts = [];
  let start = s.length % 3;
  start && parts.push(s.substr(0, start));
  for (; start < s.length; start += 3) parts.push(s.substr(start, 3));
  return parts.join(',');
};

const formatFileData = (folder, name, stat) =>
  '<tr><td class="size">' +
  formatSize(stat.size) +
  '</td><td>' +
  stat.ctime.toISOString().replace(/^([^T]+)T([^\.]+)(?:.*)$/, '$1 $2') +
  '</td><td class="name"><a href="' +
  (stat.isDirectory() ? name + '/' : name) +
  '">' +
  name +
  (stat.isDirectory() ? '/' : '') +
  '</a></td></tr>';

const listing = async (req, res, folder, justHeaders) => {
  if (justHeaders) {
    res.writeHead(200, {'Content-Type': mimeTable.html});
    res.end();
    traceCalls && console.log(green('200') + ' ' + grey(req.method) + ' ' + grey(req.url));
    return;
  }
  let entries = await fsp.readdir(folder, {withFileTypes: true});
  !showDotFiles && (entries = entries.filter(entry => entry.name && entry.name[0] !== '.'));
  const files = entries
      .filter(entry => entry.isFile())
      .sort((a, b) => (a.name < b.name ? -1 : b.name < a.name ? 1 : 0)),
    folders = entries
      .filter(entry => entry.isDirectory())
      .sort((a, b) => (a.name < b.name ? -1 : b.name < a.name ? 1 : 0)),
    items = folders.concat(files),
    title = 'Directory: <code>' + folder.replace(/\//g, '<wbr>/') + '</code>',
    isTop = !path.relative(rootFolder, folder),
    statPromises = [fsp.stat(folder)],
    names = ['.'];
  !isTop && (statPromises.push(fsp.stat(path.join(folder, '..'))), names.push('..'));
  items.length &&
    (statPromises.push(...items.map(x => fsp.stat(path.join(folder, x.name)))), names.push(...items.map(x => x.name)));
  const stats = await Promise.all(statPromises);
  let table =
    '<table><thead><tr><th class="size">Size</th><th>Change Time</th><th class="name">Name</th></tr></thead><tbody>';
  for (let i = 0; i < names.length; ++i) {
    table += formatFileData(folder, names[i], stats[i]);
  }
  table += '</tbody></table>';
  res.writeHead(200, {'Content-Type': mimeTable.html});
  res.end(
    '<!doctype html><html><head><title>' +
      title +
      '</title>' +
      style +
      '</head><body><h1>' +
      title +
      '</h1>' +
      table +
      '</body></html>'
  );
  traceCalls && console.log(green('200') + ' ' + grey(req.method) + ' ' + grey(req.url));
};

////////////////////////
// send a file guessing its name using predefined patterns:
// is directory:
//   => listing (if available)
//   => + index.html
// no extension:
//   => + .html

const sendFileExt = async (req, res, url) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return bailOut(req, res, 405);

  const justHeaders = method === 'HEAD',
    fileName = path.join(rootFolder, url.pathname);
  if (fileName.includes('..')) return bailOut(req, res, 403);

  const ext = path.extname(fileName).toLowerCase(),
    stat = await fsp.stat(fileName).catch(() => null);
  if (stat && stat.isFile()) return sendFile(req, res, fileName, ext, justHeaders);

  // if you don't need fancy file name guessing just uncomment the next line
  // return bailOut(req, res);
  // optionally: you can remove the rest of the function

  const isDirectory = stat && stat.isDirectory();

  if (isDirectory) {
    const endsWithSep = fileName.length && fileName[fileName.length - 1] == path.sep;
    if (endsWithSep) {
      const altFile = path.join(fileName, 'index.html'),
        stat = await fsp.stat(altFile).catch(() => null);
      if (stat && stat.isFile()) return sendFile(req, res, altFile, '.html', justHeaders);
    } else {
      url.pathname += path.sep;
      return sendRedirect(req, res, url.href);
    }
  }

  if (!ext && fileName.length && fileName[fileName.length - 1] != path.sep) {
    const altFile = fileName + '.html',
      stat = await fsp.stat(altFile).catch(() => null);
    if (stat && stat.isFile()) return sendFile(req, res, altFile, '.html', justHeaders);
  }

  if (isDirectory && listFolders && typeof listing == 'function') return listing(req, res, fileName, justHeaders);

  return bailOut(req, res);
};

////////////////////////
// API (comment this section out to remove the functionality)

// const DEFAULT_DELAY = 1000;

// const delay = async (req, res, url) => {
//   const method = req.method.toUpperCase();
//   if (method !== 'GET' && method !== 'HEAD') return bailOut(req, res, 405);

//   const path = url.searchParams.get('path');
//   if (!path) return bailOut(req, res, 400);

//   let ms = url.searchParams.get('ms');
//   ms = ms && +ms;
//   if (isNaN(ms) || !isFinite(ms) || ms < 0) ms = DEFAULT_DELAY;

//   await new Promise(resolve => setTimeout(resolve, ms));

//   return sendFileExt(req, res, new URL(path, 'http://' + req.headers.host));
// };

// const echo = async (req, res, url) => {
//   const method = req.method.toUpperCase(),
//     justHeaders = method === 'HEAD';
//   if (method !== 'GET' && method !== 'HEAD') return bailOut(req, res, 405);

//   let ms = +url.searchParams.get('ms') || 0;
//   if (isNaN(ms) || !isFinite(ms) || ms < 0) ms = 0;

//   ms > 0 && (await new Promise(resolve => setTimeout(resolve, ms)));

//   let status = +url.searchParams.get('status') || 200;
//   if (isNaN(status) || !isFinite(status) || status < 200 || status >= 600) status = 200;

//   if (status === 204) {
//     res.writeHead(status).end();
//     traceCalls && console.log(green(status) + ' ' + grey(req.method) + ' ' + grey(req.url));
//     return;
//   }

//   const content = url.searchParams.get('content') || '';

//   if (status >= 300 && status < 400) {
//     return sendRedirect(req, res, content, status);
//   }

//   const mime = url.searchParams.get('mime') || mimeTable.txt;

//   res.writeHead(status, {'Content-Type': mime});
//   if (!justHeaders) res.write(content);
//   res.end();
//   traceCalls && console.log((status >= 400 ? red : green)(status) + ' ' + grey(req.method) + ' ' + grey(req.url));
// };

// // simple end points with an exact match (use query for params)
// const endpoints = {
//   '/--api/delay': delay,
//   '/--api/echo': echo
// };

// const processApi = (req, res, url) => {
//   const endpoint = endpoints && endpoints[url.pathname];
//   if (typeof endpoint != 'function') return false;
//   endpoint(req, res, url);
//   return true;
// };

////////////////////////
// server

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);

  if (typeof processApi == 'function' && processApi(req, res, url)) return;

  // send files and listings
  return sendFileExt(req, res, url);
});

server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// general setup

const normalizePort = val => {
  const port = parseInt(val);
  if (isNaN(port)) return val; // named pipe
  if (port >= 0) return port; // port number
  return false;
};

const portToString = port => (typeof port === 'string' ? 'pipe' : 'port') + ' ' + port;

const host = process.env.HOST || 'localhost',
  port = normalizePort(process.env.PORT || '3000');

server.on('error', error => {
  if (error.syscall !== 'listen') throw error;
  const bind = portToString(port);
  switch (error.code) {
    case 'EACCES':
      console.log(red('Error: ') + yellow(bind) + red(' requires elevated privileges') + '\n');
      process.exit(1);
    case 'EADDRINUSE':
      console.log(red('Error: ') + yellow(bind) + red(' is already in use') + '\n');
      process.exit(1);
  }
  throw error;
});

server.on('listening', () => {
  // const addr = server.address();
  // console.log(addr);
  const bind = portToString(port);
  console.log(
    grey('Listening on ') +
      yellow(host || 'all network interfaces') +
      grey(' at ') +
      yellow(bind) +
      (typeof port == 'number' ? grey(': ') + yellow(link('http://' + (host || '127.0.0.1') + ':' + port + '/')) : '')
  );
  console.log(
    grey('Serving static files from ') +
      yellow(rootFolder) +
      grey('. Use ') +
      yellow('Ctrl+C') +
      grey(' to terminate the server.\n')
  );
});

server.listen(port, host);
