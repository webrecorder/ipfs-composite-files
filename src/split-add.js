import fsp from "fs/promises";

import { concat } from './concat.js';
import { iterSegments } from "./itersegments.js";


// add file contentFilename, split into chunks as indicated by splitFile array of offsets
export async function splitAdd(ipfs, contentFilename, splitFile) {
  const cids = [];

  const stats = await fsp.stat(contentFilename);

  const offsets = parseSplits(await fsp.readFile(splitFile, {encoding: "utf8"}));

  let i = 0;

  for await (const segs of iterSegments(contentFilename, offsets)) {
    console.log(`adding through offset ${i < offsets.length ? offsets[i] : stats.size} of ${stats.size}`);
    const res = await ipfs.add(segs);
    cids.push(res.cid);
    i++;
  }

  return await concat(ipfs, cids);
}

// parse splitpoints from a file, attempt to determine format (a bit experimental)
// try to parse as following in order:
// json, eg. [10, 20, 50, ...]
// csv, eg 10,20,50 on a single line
// json or 'prefixed' json per line, eg. 
// {"offset": 10}
// {"offset": 20}
// prefix data {"offset": 50}

function parseSplits(splitFile) {
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

