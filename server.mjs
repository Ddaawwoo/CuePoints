import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = process.cwd();
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

createServer(async (request, response) => {
  try {
    const path = request.url === "/" ? "index.html" : request.url.slice(1).split("?")[0];
    const file = await readFile(join(root, path));
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(4173, "127.0.0.1");
