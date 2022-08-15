import fsp from "fs/promises";


// ===========================================================================
// iterate over filehandle until maxSize or end of stream, reading no more than buffSize bytes at a time
async function* readSegment(fh, maxSize = Number.POSITIVE_INFINITY, buffSize = 16384) {
  while (maxSize) {
    const length = Math.min(maxSize, buffSize);
    const buffer = Buffer.alloc(buffSize)
    const res = await fh.read({buffer, length});
    yield res.buffer.slice(0, res.bytesRead);
    if (!res.bytesRead) {
      break;
    }
    maxSize -= length;
  }
}


// ===========================================================================
// return async iterator which itself emits async iterator that reads each segment in 16K chunks
export async function* iterSegments(filename, offsets) {
  const {size} = await fsp.stat(filename);
  const fh = await fsp.open(filename);

  let lastOffset = 0;

  for (const offset of offsets) {
    const length = offset - lastOffset;
    yield [readSegment(fh, length), lastOffset, length, size];
    lastOffset = offset;
  }

  yield [readSegment(fh, size - lastOffset), lastOffset, size - lastOffset, size];
}


