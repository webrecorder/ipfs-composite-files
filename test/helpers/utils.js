import * as IPFS from "ipfs-core";

let ipfs;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function create(path = ".test-ipfs") {
  if (!ipfs) {
    ipfs = await IPFS.create({repo: path, offline: true});
  }
  return ipfs;
}

export async function addString(text, opts = {}) {
  const {cid} = await ipfs.add([encoder.encode(text)], opts);
  return cid;
}

export async function getBuffer(cid) {
  const buffs = [];
  let totalLength = 0;

  for await (const chunk of ipfs.cat(cid)) {
    buffs.push(chunk);
    totalLength += chunk.length;
  }

  return Buffer.concat(buffs, totalLength);
}

export async function getString(cid) {
  return decoder.decode(await getBuffer(cid));
}

