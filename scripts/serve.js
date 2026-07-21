import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative } from "node:path";

const root = normalize(new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const port = Number(process.env.PORT || 4188);
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".dreamcue":"application/json; charset=utf-8", ".svg":"image/svg+xml" };
const securityHeaders = {
  "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY"
};

createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const candidate = normalize(join(root, urlPath === "/" ? "index.html" : urlPath));
    const pathFromRoot = relative(root, candidate);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("outside root");
    const info = await stat(candidate);
    const filePath = info.isDirectory() ? join(candidate, "index.html") : candidate;
    const body = await readFile(filePath);
    response.writeHead(200, { ...securityHeaders, "Content-Type": types[extname(filePath)] || "application/octet-stream", "Cache-Control":"no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { ...securityHeaders, "Content-Type":"text/plain; charset=utf-8" }); response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`DreamPlayer Demo 0.1 is running at http://127.0.0.1:${port}`));
