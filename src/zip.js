import { ReadableStream } from "node:stream/web";
import { CID } from "multiformats/cid";

import { makeZip } from "client-zip/index.js";

import { traverseDir } from "./traverse.js";
import { concat } from "./concat.js";


// ===========================================================================
const encoder = new TextEncoder();

// ===========================================================================
async function* iterDirForZip(ipfs, cid, queue, marker) {
  // correctly handles DST
  const hoursOffset = 24 - new Date(0).getHours();
  const timezoneOffset = hoursOffset * 60 * 60 * 1000;
  //const timezoneOffset = new Date().getTimezoneOffset() * 60000;

  async function* addMarkers(iter) {
    yield marker;
    yield *iter;
    yield marker;
  }

  for await (const entry of traverseDir(ipfs, cid)) {
    const {cid, size, mtime} = entry;
    const name = entry.name.slice(1);
    const encodedName = encoder.encode(name);
    const input = addMarkers(ipfs.catFile(cid));
    const lastModified = new Date(mtime + timezoneOffset);

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
  const marker = new Uint8Array();

  let isSkipping = false;

  for await (const chunk of makeZip(iterDirForZip(ipfs, cid, queue, marker))) {
    // if at marker, commit file chunk
    // toggle isSkipping at each marker: don't skip outside file, skip file data
    if (chunk === marker) {
      // if any data written and file cid prepared
      if (queue.length && buff.length) {
        await addBuffers();
        const { cid, size } = queue.shift();
        // add already known cid from queue
        cids.push(cid);
        sizes[cid] = Number(size);
      }
      isSkipping = !isSkipping;
    } else if (!isSkipping) {
      buff.push(chunk);
    }
  }

  await addBuffers();

  return await concat(ipfs, cids, sizes);
}
