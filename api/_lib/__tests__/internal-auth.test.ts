import { Readable } from "stream";
import { describe, expect, it } from "vitest";
import type { VercelRequest } from "@vercel/node";
import { readRawBody } from "../internal-auth";

function reqFromBody(body: unknown): VercelRequest {
  const req = Readable.from([]) as VercelRequest;
  Object.assign(req, { body });
  return req;
}

describe("readRawBody", () => {
  it("reads the request stream when raw bytes are available", async () => {
    const req = Readable.from(['{"code":"ALEXNG12"}']) as VercelRequest;

    await expect(readRawBody(req)).resolves.toBe('{"code":"ALEXNG12"}');
  });

  it("falls back to Vercel dev parsed body when the stream is already consumed", async () => {
    await expect(readRawBody(reqFromBody({ code: "ALEXNG12" }))).resolves.toBe('{"code":"ALEXNG12"}');
  });

  it("falls back to string body without changing bytes", async () => {
    await expect(readRawBody(reqFromBody('{"code":"ALEXNG12"}'))).resolves.toBe('{"code":"ALEXNG12"}');
  });
});
