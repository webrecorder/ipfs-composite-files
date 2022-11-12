import { ReadableStream } from "node:stream/web";
import { CID } from "multiformats/cid";

import { loadFiles } from "client-zip/index.js";

import { traverseDir } from "./traverse.js";
import { concat } from "./concat.js";

// ===========================================================================
const encoder = new TextEncoder();

// ===========================================================================
async function* iterDirForZip(ipfs, cid) {
  for await (const entry of traverseDir(ipfs, cid)) {
    const file = {
      bytes: {
        iter: ipfs.catFile(entry.cid),
        id: entry.cid,
      },
      modDate: new Date(entry.mtime),
      encodedName: encoder.encode(entry.name.slice(1)),
      uncompressedSize: entry.size,
    };

    yield file;
  }
}

// ===========================================================================
export async function createZip(ipfs, cid) {
  const cids = [];
  const sizes = {};

  let buff = [];

  const addBuffers = async () => {
    if (buff.length) {
      const { cid } = await ipfs.addFile(buff);
      cids.push(cid);
      sizes[cid] = buff.reduce((sum, x) => sum + x.length, 0);
      buff = [];
    }
  };

  for await (const entry of loadFiles(iterDirForZip(ipfs, cid))) {
    if (entry instanceof Uint8Array) {
      buff.push(entry);
    } else {
      await addBuffers();
      if (typeof entry === "object" && entry.id instanceof CID) {
        const { id, size } = entry;
        cids.push(id);
        sizes[id] = Number(size);
      }
    }
  }

  await addBuffers();

  return await concat(ipfs, cids, sizes);
}
