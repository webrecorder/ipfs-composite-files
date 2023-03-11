import { MemoryBlockstore } from "blockstore-core";

import { importer } from 'ipfs-unixfs-importer';
import { exporter } from 'ipfs-unixfs-exporter';

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as dagPB from '@ipld/dag-pb';


// ===========================================================================
export class MemoryStore
{
  constructor() {
    this.store = new MemoryBlockstore();
  }

  async addFile(iter, opts = {}) {
    let last = null;

    const source = [{content: iter}];

    if (opts.chunker) {
      opts = {...opts, maxChunkSize: Number(opts.chunker.split("-")[1]), chunker: "fixed"};
    }

    for await (const entry of importer(source, this.store, opts)) {
      last = entry;
    }
    return last;
  }

  async* addAllFiles(iter, opts) {
    let last = null;

    const source = iter;

    if (opts.chunker) {
      opts = {...opts, maxChunkSize: Number(opts.chunker.split("-")[1]), chunker: "fixed"};
    }

    for await (const entry of importer(source, this.store, opts)) {
      yield entry;
    }
  }

  blockGet(cid) {
    return this.store.get(cid);
  } 

  async blockPut(bytes) {
    const hash = await sha256.digest(bytes);
    const cid = CID.create(1, dagPB.code, hash);
    this.store.put(cid, bytes);
    return cid;
  } 

  async* catFile(cid) {
    const entry = await exporter(cid, this.store);

    for await (const chunk of entry.content()) {
      yield chunk;
    }
  }
}


// ===========================================================================
export class RealIPFSStore
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

