import test from "ava";

import fsp from "fs/promises";

import * as utils from "./helpers/utils.js";

import { concat } from "../src/concat.js";
import { traverse } from "../src/traverse.js";
import { splitAdd, parseSplitsFile } from "../src/split-add.js";

let ipfs;

const outputCids = {};

const IANA_CDXJ_OFFSETS = [
  265, 2527, 57313, 63504, 66725, 171256, 183028, 187165, 192222, 196101,
  197421, 200698, 209409, 216133, 220034, 365641, 512152, 518300, 519889,
];

// ===========================================================================
async function testConcat(t, opts = {}, ...strings) {
  const cids = [];

  for await (const string of strings) {
    cids.push(await utils.addString(string, opts));
  }

  const mergedCid = await concat(ipfs, cids);
  outputCids[t.title] = mergedCid;

  const actual = await utils.getString(mergedCid);

  const expected = strings.join("");

  t.is(expected, actual);
}

// ===========================================================================
async function testVerifyRanges(t, concatResultName, ranges) {
  const cid = outputCids[concatResultName];

  let i = 0;

  for await (const chunk of traverse(ipfs, cid)) {
    const len = typeof ranges[i] === "string" ? ranges[i].length : ranges[i];
    t.is(chunk.length, len);
    i++;
  }

  t.is(i, ranges.length);
}

testVerifyRanges.title = (providedTitle, concatResultName) =>
  "verify range: " + concatResultName;

// ===========================================================================
async function parseOffsets(t, splitsFilename, expected) {
  splitsFilename = utils.dataDir + splitsFilename;

  const offsets = parseSplitsFile(
    await fsp.readFile(splitsFilename, { encoding: "utf8" })
  );

  t.deepEqual(offsets, expected);
}

// ===========================================================================
async function addFile(
  t,
  contentFilename,
  splitsFilename,
  cid1String,
  opts = {}
) {
  splitsFilename = utils.dataDir + splitsFilename;
  contentFilename = utils.dataDir + contentFilename;

  const offsets = parseSplitsFile(
    await fsp.readFile(splitsFilename, { encoding: "utf8" })
  );

  let lastEntry = null;

  for await (const entry of splitAdd(ipfs, contentFilename, offsets, opts)) {
    lastEntry = entry;
  }

  const cid = lastEntry.cid;
  outputCids[t.title] = cid;

  t.is(cid.toString(), cid1String);

  const expected = await fsp.readFile(contentFilename);
  const actual = await utils.getBuffer(cid);

  t.is(actual.length, expected.length);
  t.deepEqual(actual, expected);
}

// ===========================================================================
function computeOffsetDiffs(source, totalSize) {
  let diffs = [];
  for (let i = 1; i < source.length; i++) {
    diffs.push(source[i] - source[i - 1]);
  }
  diffs.push(totalSize - source[source.length - 1]);
  return diffs;
}

// ===========================================================================
test.before(async () => {
  ipfs = await utils.create(".test-ipfs");

  //const {size} = await fsp.stat("./test/data/iana.warc");
  //IANA_CDXJ_OFFSET_DIFFS = computeOffsetDiffs(IANA_CDXJ_OFFSETS, size);
});

test.after(async () => {
  await fsp.rm(".test-ipfs", { recursive: true });
});

// ===========================================================================
test(
  "concat 2",
  testConcat,
  { cidVersion: 1, rawLeaves: false },
  "hello world",
  "test data"
);

test(
  "concat 2 with rawLeaves",
  testConcat,
  { rawLeaves: true },
  "hello world",
  "test data"
);

test(
  "concat 3",
  testConcat,
  { cidVersion: 1, rawLeaves: false },
  "hello world",
  "\n",
  "test data"
);

test(testVerifyRanges, "concat 2", ["hello world", "test data"]);
test(testVerifyRanges, "concat 2 with rawLeaves", ["hello world", "test data"]);
test(testVerifyRanges, "concat 3", ["hello world", "\n", "test data"]);

test("parse cdxj offsets", parseOffsets, "iana.cdxj", IANA_CDXJ_OFFSETS);

test(
  "add iana.warc split offsets",
  addFile,
  "iana.warc",
  "iana.cdxj",
  "bafybeihqptzlm43udmr2riplqtgxa4brx2thqnl7hpjsfn3rtgtjfrowya"
);

test(
  "add iana.warc split offsets, raw, 32K blocks",
  addFile,
  "iana.warc",
  "iana.cdxj",
  "bafybeia2pcz7cmv27x7iib6qaerklhhppnx4eqmche4gins644huoq3pcu",
  { rawLeaves: true, chunker: "size-32768", cidVersion: 1 }
);

test(
  testVerifyRanges,
  "add iana.warc split offsets",
  // prettier-ignore
  [
    265, 2262,
    54786,
    6191,   3221,
    104531,
    11772,  4137,   5057,
    3879,  1320,   3277,   8711,
    6724,  3901,
    145607,
    146511,
    6148,  1589,
    32794
]
);

test(
  testVerifyRanges,
  "add iana.warc split offsets, raw, 32K blocks",
  // prettier-ignore
  [
    265, 2262,
    32768, 22018, // 54786 split into 32K blocks
    6191,  3221,
    32768, 32768, 32768, 6227, // 104531 split into 32K blocks
    11772, 4137,   5057,
    3879,  1320,   3277,   8711,
    6724,  3901,
    32768, 32768, 32768, 32768, 14535, // 145607 split into 32K blocks
    32768, 32768, 32768, 32768, 15439, // 146511 split into 32K blocks
    6148,  1589,
    32768, 26, //32794 split into 32K blocks
]
);
