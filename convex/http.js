"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const aicrendital_1 = require("./aicrendital");
const secert_1 = require("./secert");
const http = (0, server_1.httpRouter)();
http.route({
    path: "/verify-api-key",
    method: "POST",
    handler: secert_1.publicaction,
});
// wee need to jsonify the response
http.route({
    path: "/credentials",
    method: "GET",
    handler: aicrendital_1.getCredential,
});
exports.default = http; // <-- this is required
//# sourceMappingURL=http.js.map