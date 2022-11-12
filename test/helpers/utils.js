//import * as IPFS from "ipfs-core";
//import { createInMemoryRepo } from "../../src/inmemrepo.js";

import { BlockFS } from "../../src/store.js";

let ipfs;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function create() {
  if (!ipfs) {
    //ipfs = new RealIPFS(await IPFS.create(await createInMemoryRepo()));
    ipfs = new BlockFS();
  }
  return ipfs;
}

export async function addString(text, opts = {}) {
  //const { cid } = await ipfs.addFile(text, opts);
  const { cid } = await ipfs.addFile([encoder.encode(text)], opts);
  return cid;
}

export async function getBuffer(cid) {
  const buffs = [];
  let totalLength = 0;

  for await (const chunk of ipfs.catFile(cid)) {
    buffs.push(chunk);
    totalLength += chunk.length;
  }

  return Buffer.concat(buffs, totalLength);
}

export async function getString(cid) {
  return decoder.decode(await getBuffer(cid));
}

export const dataDir = new URL("../data/", import.meta.url).pathname;

class RealIPFS
{
  constructor(ipfsreal) {
    this.ipfs = ipfsreal;
  }

  addFile(data, opts) {
    return this.ipfs.add(data, opts);
  }

  addAllFiles(datas, opts) {
    return this.ipfs.addAll(datas, opts);
  }

  catFile(cid) {
    return this.ipfs.cat(cid);
  }

  blockPut(data, opts) {
    return this.ipfs.block.put(data, opts);
  }

  blockGet(cid) {
    return this.ipfs.block.get(cid);
  }
}
