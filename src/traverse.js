import { code as rawCode } from 'multiformats/codecs/raw';
import { UnixFS } from 'ipfs-unixfs';

// ===========================================================================
export async function* traverse(ipfs, cid, depth = Number.POSITIVE_INFINITY, offset = 0, length = 0) {
  const {value} = await ipfs.dag.get(cid);

  if (cid.code === rawCode) {
    yield {cid, offset, length: value.length, type: "raw"};
    return;
  }

  let unixfs = UnixFS.unmarshal(value.Data);

  if (unixfs.isDirectory()) {
    throw new Error("this operation is supported only for files");
  }

  const initialOffset = offset;

  if (!unixfs.data && unixfs.blockSizes.length) {
    if (depth > 0) {
      for (let i = 0; i < unixfs.blockSizes.length; i++) {
        yield* traverse(ipfs, value.Links[i].Hash, depth - 1, offset, unixfs.blockSizes[i]);

        offset += unixfs.blockSizes[i];
      }
    } else {
      yield {cid, offset, length: unixfs.fileSize(), type: "unixfs"};
      offset += unixfs.fileSize();
    }

    if (length && length != offset - initialOffset) {
      throw new Error(`block size mismatch, expected ${length} but added up to ${offset - initialOffset}`);
    }

  } else if (unixfs.data) {
    yield {cid, offset, length: unixfs.data.length, type: "unixfs"};
  }
}


// ===========================================================================
export async function* traverseDir(ipfs, cid, name = "", includeDir = false) {
  const {value} = await ipfs.dag.get(cid);

  if (cid.code === rawCode) {
    yield {cid, size: value.length, name, mtime: 0, dir: false};
    return;
  }

  let unixfs = UnixFS.unmarshal(value.Data);

  if (!unixfs.isDirectory()) {
    yield {cid, size: unixfs.fileSize(), name, mtime: unixfs.mtime || 0, dir: false};
    return;
  } else if (name && includeDir) {
    yield {cid, size: 0, name: name + "/", mtime: unixfs.mtime || 0, dir: true};
  }

  for (const link of value.Links) {
    yield* traverseDir(ipfs, link.Hash, name + "/" + link.Name);
  }
}
