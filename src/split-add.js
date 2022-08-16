
import { concat } from './concat.js';
import { iterSegments } from "./itersegments.js";


// ===========================================================================
// add file contentFilename, split into chunks as indicated by splitFile array of offset
export async function* splitAdd(ipfs, contentFilename, offsets, opts = {}) {
  const cids = [];
  const sizes = {};

  let totalSize;

  offsets.sort((a, b) => a - b);

  for await (const [segs, offset, length, totSize] of iterSegments(contentFilename, offsets)) {
    const {cid} = await ipfs.add(segs, opts);
    cids.push(cid);
    sizes[cid] = length;

    totalSize = totSize;

    yield {cid, offset, length, totalSize};
  }

  const cid = await concat(ipfs, cids, sizes);

  yield {cid, offset: 0, length: totalSize, totalSize};
}


// ===========================================================================
// parse splitpoints from a file, attempt to determine format (a bit experimental)
// try to parse as following in order:
// json, eg. [10, 20, 50, ...]
// csv, eg 10,20,50 on a single line
// json or 'prefixed' json per line, eg. 
// {"offset": 10}
// {"offset": 20}
// prefix data {"offset": 50}

export function parseSplitsFile(splitFile) {
  try {
    return JSON.parse(splitFile);
  } catch (e) {
    
  }

  const lines = splitFile.trim().split("\n");

  // single line, but not json, treat as csv
  if (lines.length === 0) {
    return lines[0].split(",");
  }

  // try json per line, with field containing 'offset'
  // or cdxj, prefix, followed by json, containing 'offset'
  return lines.map((line) => {
    try {
      line = JSON.parse(line);
      return Number(line.offset);
    } catch (e) {

    }
 
    line = line.slice(line.indexOf(" {"));
    line = JSON.parse(line);
    return Number(line.offset);
  });
}

