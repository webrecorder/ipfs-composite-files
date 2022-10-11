import { Readable } from "node:stream";

import fs from "fs";

import fsp from "fs/promises";

import { splitAdd, parseSplits } from "./src/split-add.js";


// ===========================================================================
// add file contentFilename, split into chunks as indicated by offsets loaded from splitsFilename
export async function splitAddWithSplitsFile(
  ipfs,
  contentFilename,
  splitsFilename,
  opts = {},
  callback = null
) {
  const offsets = parseSplits(
    await fsp.readFile(splitsFilename, { encoding: "utf8" })
  );

  const stat = await fsp.stat(contentFilename);
  const totalSize = stat.size;

  const nodeReadable = fs.createReadStream(contentFilename);

  const stream = Readable.toWeb(nodeReadable);

  return await splitAdd(ipfs, stream, totalSize, offsets, opts, callback);
}

