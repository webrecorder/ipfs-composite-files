import { concat } from "./concat.js";

// ===========================================================================
export async function splitAdd(
  ipfs,
  stream,
  totalSize,
  offsets,
  opts = {},
  callback = null
) {
  const cids = [];
  const sizes = {};

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

  const fh = new FixedSizeIter(stream);

  let i = 0;
  let offset = 0;

  for await (const segs of iterSegments(fh, offsets, 1024 * 256)) {
    const { cid, size } = await ipfs.addFile(segs, opts);
    cids.push(cid);

    const length = offsets[i] - offset;
    sizes[cid] = length;

    if (callback) {
      callback({ cid, offset, length, totalSize });
    }

    offset = offsets[i++];
  }

  const cid = await concat(ipfs, cids, sizes);

  return { cid, size: totalSize };
}

// ===========================================================================
// todo: use existing impl of this?
// adapted from warcio
class FixedSizeIter {
  constructor(stream) {
    this.reader = stream.getReader();
    this.prevChunk = null;
  }

  async readNext(sizeLimit = -1) {
    const chunks = [];
    let size = 0;
    let chunk;

    while (true) {
      if (this.prevChunk) {
        chunk = this.prevChunk;
        this.prevChunk = null;
      } else {
        const { done, value } = await this.reader.read();
        if (done) {
          break;
        }
        chunk = value;
      }

      if (sizeLimit >= 0) {
        if (chunk.length > sizeLimit) {
          const [first, remainder] = [
            chunk.slice(0, sizeLimit),
            chunk.slice(sizeLimit),
          ];
          chunks.push(first);
          size += first.byteLength;
          this.prevChunk = remainder;
          break;
        } else if (chunk.length === sizeLimit) {
          chunks.push(chunk);
          size += chunk.byteLength;
          sizeLimit = 0;
          break;
        } else {
          sizeLimit -= chunk.length;
        }
      }
      chunks.push(chunk);
      size += chunk.byteLength;
    }

    return this.mergeChunks(chunks, size);
  }

  mergeChunks(chunks, size) {
    if (chunks.length === 1) {
      return chunks[0];
    }
    const buffer = new Uint8Array(size);

    let offset = 0;

    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return buffer;
  }
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
    const res = await fh.readNext(length);
    if (!res || !res.length) {
      break;
    }
    yield res;
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

export function parseSplits(splitText) {
  try {
    return JSON.parse(splitText);
  } catch (e) {}

  const lines = splitText.trim().split("\n");

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
