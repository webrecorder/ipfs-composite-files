import { code as rawCode } from "multiformats/codecs/raw";
import { UnixFS } from "ipfs-unixfs";

// ===========================================================================
export async function getSize(ipfs, cid, allowDir = false) {
  const { value } = await ipfs.dag.get(cid);

  // if raw, use length of value
  if (cid.code == rawCode) {
    return value.length;
  }

  // otherwise, parse to unixfs node
  let unixfs = UnixFS.unmarshal(value.Data);

  if (!allowDir && unixfs.isDirectory()) {
    throw new Error(`cid ${cid} is a directory, only files allowed`);
  }

  if (unixfs.data) {
    return unixfs.data.length;
  } else if (!unixfs.isDirectory()) {
    return unixfs.fileSize();
  } else {
    return unixfs.blockSizes.reduce((a, b) => a + b, 0);
  }
}

// ===========================================================================
export async function concat(ipfs, cids, sizes = {}) {
  if (cids.length === 1) {
    return cids[0];
  }

  const node = new UnixFS({ type: "file" });

  const Links = await Promise.all(
    cids.map(async (cid) => {
      const Tsize =
        sizes[cid] !== undefined ? sizes[cid] : await getSize(ipfs, cid);

      return {
        Name: "",
        Hash: cid,
        Tsize,
      };
    })
  );

  Links.map(({ Tsize }) => node.addBlockSize(Tsize));

  const Data = node.marshal();

  return await ipfs.dag.put({ Data, Links }, { storeCodec: "dag-pb" });
}

// ===========================================================================
async function _createDirLinks(ipfs, files) {
  const names = Object.keys(files);
  names.sort();

  return await Promise.all(
    names.map(async (Name) => {
      const { cid, size } = files[Name];

      const Tsize = size !== undefined ? size : await getSize(ipfs, cid, true);

      return {
        Name,
        Hash: cid,
        Tsize,
      };
    })
  );
}

// ===========================================================================
export async function makeDir(ipfs, files) {
  const node = new UnixFS({ type: "directory" });

  const Data = node.marshal();

  const Links = await _createDirLinks(ipfs, files);

  return await ipfs.dag.put({ Data, Links }, { storeCodec: "dag-pb" });
}

// ===========================================================================
export async function addToDir(ipfs, dirCid, files) {
  if (dirCid.code == rawCode) {
    throw new Error("raw cid -- not a directory");
  }

  const { value } = await ipfs.dag.get(dirCid);
  let { Data, Links } = value;

  let node = UnixFS.unmarshal(Data);

  if (!node.isDirectory()) {
    throw new Error(`file cid -- not a directory`);
  }

  const newLinks = await _createDirLinks(ipfs, files);

  Links = [...Links, ...newLinks];

  // todo: disallow duplicates
  Links.sort((a, b) => (a.Name < b.Name ? -1 : 1));

  return await ipfs.dag.put({ Data, Links }, { storeCodec: "dag-pb" });
}
