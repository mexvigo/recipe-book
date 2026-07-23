/* Minimal static file server (no dependencies) for local development.
   Run: node server.js  →  serves this folder at http://localhost:5178 */
var http = require("http");
var fs = require("fs");
var path = require("path");

var ROOT = __dirname;
var PORT = process.env.PORT || 5178;
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http.createServer(function (req, res) {
  var urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  var filePath = path.join(ROOT, path.normalize(urlPath));
  if (filePath.indexOf(ROOT) !== 0) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log("Recipe Book running at http://localhost:" + PORT);
});
