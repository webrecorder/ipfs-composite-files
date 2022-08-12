import { code as rawCode } from 'multiformats/codecs/raw';
import { UnixFS } from 'ipfs-unixfs';

export async function getSize(ipfs, cid) {
  const data = await ipfs.dag.get(cid);

  // if raw, use length of data itself
  if (cid.code == rawCode) {
    return data.length;
  }

  // otherwise, parse to unixfs node
  let unixfs = UnixFS.unmarshal(data.value.Data);

  if (unixfs.isDirectory()) {
    throw new Error(`cid ${cid} is a directory, can only concat files`);
  }

  if (unixfs.data) {
    return unixfs.data.length;
  } else {
    return unixfs.fileSize();
  }
}

export async function concat(ipfs, cids) {
  const node = new UnixFS({ type: 'file' });

  const Links = await Promise.all(cids.map(async (cid) => {
    const Tsize = await getSize(ipfs, cid);

    return {
      Name: '',
      Hash: cid,
      Tsize
    }
  }));

  Links.map(({ Tsize }) => node.addBlockSize(Tsize))

  const Data = node.marshal();

  return await ipfs.dag.put({Data, Links}, {storeCodec: "dag-pb"});
}
