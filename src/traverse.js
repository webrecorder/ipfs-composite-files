import { code as rawCode } from 'multiformats/codecs/raw';
import { UnixFS } from 'ipfs-unixfs';


export async function* traverse(ipfs, cid, depth = Number.POSITIVE_INFINITY, offset = 0, length = 0) {
  if (cid.code === rawCode) {
    yield {cid, offset, length, type: "raw"};
  }

  const {value} = await ipfs.dag.get(cid);

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
