// Serve the project for the live viewer:  node tools/serve.mjs [--port 8080]
import { startServer, parseArgs } from './lib.mjs';

const a = parseArgs();
const { port } = await startServer({ port: +(a.port || 8080) });
console.log(`shanshui: http://127.0.0.1:${port}/          the film, live`);
console.log(`          http://127.0.0.1:${port}/?scene=s03  a single painting (s01..s10)`);
