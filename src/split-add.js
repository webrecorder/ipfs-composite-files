import fsp from "fs/promises";

import { concat } from "./concat.js";

// ===========================================================================
export async function splitAddWithSplitsFile(
  ipfs,
  contentFilename,
  splitsFilename,
  opts = {},
  callback = null
) {
  const offsets = parseSplitsFile(
    await fsp.readFile(splitsFilename, { encoding: "utf8" })
  );

  return await splitAdd(ipfs, contentFilename, offsets, opts, callback);
}

// ===========================================================================
// add file filename, split into chunks as indicated by splitFile array of offset
export async function splitAdd(
  ipfs,
  filename,
  offsets,
  opts = {},
  callback = null
) {
  const cids = [];
  const sizes = {};

  const stat = await fsp.stat(filename);
  const totalSize = stat.size;

  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] === 0) {
      offsets[i] = totalSize;
      break;
    }
  }

  offsets.sort((a, b) => a - b);

  // last offset is the total length
  if (offsets[offsets.length - 1] !== totalSize) {
    offsets.push(totalSize);
  }

  const fh = await fsp.open(filename);

  let i = 0;
  let offset = 0;

  for await (const segs of iterSegments(fh, offsets, 1024 * 256)) {
    const { cid } = await ipfs.add(segs, opts);
    cids.push(cid);

    const length = offsets[i] - offset;
    sizes[cid] = length;

    if (callback) {
      callback({ cid, offset, length, totalSize });
    }

    offset = offsets[i++];
  }

  await fh.close();

  const cid = await concat(ipfs, cids, sizes);

  return { cid, size: totalSize };
}

// ===========================================================================
// iterate over filehandle until maxSize or end of stream, reading no more than buffSize bytes at a time
async function* readSegment(
  fh,
  maxSize = Number.POSITIVE_INFINITY,
  buffSize = 16384
) {
  while (maxSize) {
    const length = Math.min(maxSize, buffSize);
    const buffer = Buffer.alloc(buffSize);
    const res = await fh.read({ buffer, length });
    if (!res.bytesRead) {
      break;
    }
    yield res.buffer.slice(0, res.bytesRead);
    maxSize -= length;
  }
}

// ===========================================================================
// return async iterator which itself emits async iterator that reads each segment in 16K chunks
export async function* iterSegments(fh, offsets, buffSize = 16384) {
  let lastOffset = 0;

  for (const offset of offsets) {
    const length = offset - lastOffset;
    yield readSegment(fh, length, buffSize);
    lastOffset = offset;
  }

  //yield readSegment(fh, Number.POSITIVE_INFINITY, buffSize);
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
  } catch (e) {}

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
    } catch (e) {}

    line = line.slice(line.indexOf(" {"));
    line = JSON.parse(line);
    return Number(line.offset);
  });
}
