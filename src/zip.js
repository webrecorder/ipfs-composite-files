import { ReadableStream } from "node:stream/web";
import { CID } from "multiformats/cid";

import { makeZip } from "client-zip/index.js";

import { traverseDir } from "./traverse.js";
import { concat } from "./concat.js";

class MockFile {};
global.File = MockFile;

// ===========================================================================
const encoder = new TextEncoder();

// ===========================================================================
async function* iterDirForZip(ipfs, cid, queue) {
  for await (const entry of traverseDir(ipfs, cid)) {
    const {cid, size, mtime} = entry;
    const name = entry.name.slice(1);
    const encodedName = encoder.encode(name);
    const input = ipfs.catFile(cid);
    const lastModified = new Date(mtime);

    queue.push({name, encodedName, cid, size});
    yield {input, lastModified, name, size};
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

  const queue = [];
  const decoder = new TextDecoder();
  const opts = {utcDates: true, skipEmitFileData: true};

  let count = 0;

  for await (const chunk of makeZip(iterDirForZip(ipfs, cid, queue), opts)) {
    buff.push(chunk);
    count++;

    // if this chunk is the name of the zip file entry, then flush the remainder to own CID, and split after this block
    // to avoid false positives, must be at least 2 blocks in the buff list
    if (count >= 2 && queue.length && queue[0].encodedName.length === chunk.length && decoder.decode(chunk) === queue[0].name) {
      count = 0;
      await addBuffers();
      const { cid, size } = queue.shift();
      cids.push(cid);
      sizes[cid] = Number(size);
    }
  }

  await addBuffers();

  return await concat(ipfs, cids, sizes);
}
