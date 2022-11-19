import { MemoryStore } from "../../src/store.js";

let store;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function create() {
  if (!store) {
    //store = new RealIPFS(await IPFS.create(await createInMemoryRepo()));
    store = new MemoryStore();
  }
  return store;
}

export async function addString(text, opts = {}) {
  //const { cid } = await store.addFile(text, opts);
  const { cid } = await store.addFile([encoder.encode(text)], opts);
  return cid;
}

export async function getBuffer(cid) {
  const buffs = [];
  let totalLength = 0;

  for await (const chunk of store.catFile(cid)) {
    buffs.push(chunk);
    totalLength += chunk.length;
  }

  return Buffer.concat(buffs, totalLength);
}

export async function getString(cid) {
  return decoder.decode(await getBuffer(cid));
}

export const dataDir = new URL("../data/", import.meta.url).pathname;
