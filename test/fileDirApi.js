import test from "ava";

import fsp from "fs/promises";

import * as utils from "./helpers/utils.js";

import { CID } from "multiformats/cid";
import { makeDir, addToDir } from "../src/concat.js";
import { traverse, traverseDir, getStat } from "../src/traverse.js";
import { splitAddWithSplitsFile } from "../cli-utils.js";
import { parseSplits } from "../src/split-add.js";
import { createZip } from "../src/zip.js";

let ipfs;


// ===========================================================================

test.before(async () => {
  ipfs = await utils.create(".test-ipfs-dir");
});

async function addFileSplit(t, contentFilename, splitsFilename, expected) {
  contentFilename = utils.dataDir + contentFilename;
  splitsFilename = utils.dataDir + splitsFilename;

  const { cid, size } = await splitAddWithSplitsFile(
    ipfs,
    contentFilename,
    splitsFilename
  );

  t.is(cid.toString(), expected);
}

async function addFile(t, filename, opts, expected) {
  const { cid } = await ipfs.add(
    await fsp.readFile(utils.dataDir + filename),
    opts
  );

  t.is(cid.toString(), expected);
}

async function popDir(files, root, prefix) {
  for (const dirent of await fsp.readdir(root, { withFileTypes: true })) {
    if (dirent.isFile()) {
      files.push({
        path: prefix + dirent.name,
        content: await fsp.readFile(root + dirent.name),
      });
    } else if (dirent.isDirectory()) {
      files.push({
        path: prefix + dirent.name,
      });

      await popDir(files, root + dirent.name + "/", prefix + dirent.name + "/");
    }
  }
}

async function testVerifyDir(t, cid, expected) {
  cid = CID.parse(cid);

  const files = [];

  for await (const entry of traverseDir(ipfs, cid)) {
    files.push({
      cid: entry.cid.toString(),
      name: entry.name,
      size: entry.size,
    });
  }

  t.deepEqual(files, expected);
}

async function addDir(t, dirPath, expected) {
  const files = [];

  await popDir(files, utils.dataDir + dirPath, "");

  let cid;

  for await (const entry of ipfs.addAll(files, {
    wrapWithDirectory: true,
    cidVersion: 1,
  })) {
    cid = entry.cid;
  }

  t.is(cid.toString(), expected);
}

async function testZipDir(t, cid, expected) {
  cid = await createZip(ipfs, CID.parse(cid));

  t.is(cid.toString(), expected);
}
async function testCreateDir(t, files, expected) {
  const cid = await makeDir(ipfs, files);

  t.is(cid.toString(), expected);
}

async function testAddToDir(t, cid, files, expected) {
  cid = CID.parse(cid);

  cid = await addToDir(ipfs, cid, files);

  t.is(cid.toString(), expected);
}

async function testFileSize(t, cidpath, expected) {
  const entry = await getStat(ipfs, cidpath);
  const size = entry && entry.size;

  t.is(size, expected);
}

async function testVerifyRanges(t, cid, ranges) {
  cid = CID.parse(cid);

  let i = 0;

  for await (const chunk of traverse(ipfs, cid, 1)) {
    t.is(chunk.length, ranges[i][1]);
    t.is(chunk.cid.toString(), ranges[i][0]);
    i++;
  }

  t.is(i, ranges.length);
}

test(
  "add warc",
  addFileSplit,
  "iana.warc",
  "iana.cdxj",
  "bafybeihqptzlm43udmr2riplqtgxa4brx2thqnl7hpjsfn3rtgtjfrowya"
);

test(
  "add cdx",
  addFile,
  "iana.cdxj",
  { cidVersion: 1 },
  "bafkreibgqhyupecf3om6wrya5hp6gflzey345qrb5nl2zcipx5ru5smiey"
);

test(
  "create archives dir",
  testCreateDir,
  {
    "iana.warc": {
      cid: CID.parse(
        "bafybeihqptzlm43udmr2riplqtgxa4brx2thqnl7hpjsfn3rtgtjfrowya"
      ),
    },
  },
  "bafybeidw6kjwzuemf2c6djx2gua4dm7x4cithvj7ra3bycmaeuxkvqniuu"
);

test(
  "create indexes dir",
  testCreateDir,
  {
    "iana.cdxj": {
      cid: CID.parse(
        "bafkreibgqhyupecf3om6wrya5hp6gflzey345qrb5nl2zcipx5ru5smiey"
      ),
    },
  },
  "bafybeiamyttrkfzdpwyfja5ilcfpc32ekxzqqz52jdmveeh64oerggjo34"
);

test(
  "add files direct",
  addDir,
  "dir/",
  "bafybeibr6htxktvj4zlmym3junyprga37wrw64yhx3zqvskvrupyohga2y"
);

test(
  "verify dir 1",
  testVerifyDir,
  "bafybeibr6htxktvj4zlmym3junyprga37wrw64yhx3zqvskvrupyohga2y",
  [
    {
      cid: "bafkreiftimfhuhoqkjjsoa62szrjkeu57f5qbbruj2t5ilxv3azds3jjmi",
      name: "/datapackage-digest.json",
      size: 675,
    },
    {
      cid: "bafkreigy4p4k56qj3vg5nczznv4x7kmfygete37qg2vbmkrj2cfezco4cm",
      name: "/datapackage.json",
      size: 817,
    },
    {
      cid: "bafkreifragagtvk3w6dplny5pfjeurkeyvqccf5amlw7huzj4ndiu3g6yi",
      name: "/pages/pages.jsonl",
      size: 1746,
    },
  ]
);

test(
  "add to dir",
  testAddToDir,
  "bafybeibr6htxktvj4zlmym3junyprga37wrw64yhx3zqvskvrupyohga2y",
  {
    indexes: {
      cid: CID.parse(
        "bafybeiamyttrkfzdpwyfja5ilcfpc32ekxzqqz52jdmveeh64oerggjo34"
      ),
    },
    archive: {
      cid: CID.parse(
        "bafybeidw6kjwzuemf2c6djx2gua4dm7x4cithvj7ra3bycmaeuxkvqniuu"
      ),
    },
  },
  "bafybeidsbx6l3axec76hgxpajcorcq2shb5hewasmyimohztpr6pybzrxm"
);

test(
  "verify dir 2 (wacz)",
  testVerifyDir,
  "bafybeidsbx6l3axec76hgxpajcorcq2shb5hewasmyimohztpr6pybzrxm",
  [
    {
      cid: "bafybeihqptzlm43udmr2riplqtgxa4brx2thqnl7hpjsfn3rtgtjfrowya",
      name: "/archive/iana.warc",
      size: 552683,
    },
    {
      cid: "bafkreiftimfhuhoqkjjsoa62szrjkeu57f5qbbruj2t5ilxv3azds3jjmi",
      name: "/datapackage-digest.json",
      size: 675,
    },
    {
      cid: "bafkreigy4p4k56qj3vg5nczznv4x7kmfygete37qg2vbmkrj2cfezco4cm",
      name: "/datapackage.json",
      size: 817,
    },
    {
      cid: "bafkreibgqhyupecf3om6wrya5hp6gflzey345qrb5nl2zcipx5ru5smiey",
      name: "/indexes/iana.cdxj",
      size: 5866,
    },
    {
      cid: "bafkreifragagtvk3w6dplny5pfjeurkeyvqccf5amlw7huzj4ndiu3g6yi",
      name: "/pages/pages.jsonl",
      size: 1746,
    },
  ]
);

test(
  "size file in dir",
  testFileSize,
  "bafybeidsbx6l3axec76hgxpajcorcq2shb5hewasmyimohztpr6pybzrxm/archive/iana.warc",
  552683
);

test(
  "size file direct",
  testFileSize,
  "bafybeihqptzlm43udmr2riplqtgxa4brx2thqnl7hpjsfn3rtgtjfrowya",
  552683
);


test(
  "zip",
  testZipDir,
  "bafybeidsbx6l3axec76hgxpajcorcq2shb5hewasmyimohztpr6pybzrxm",
  "bafybeibendipv6yz5n6ozh6lxlrun4xshosz2lfxjzsue4pqyjq2tjank4"
);

test(
  "verify zip blocks",
  testVerifyRanges,
  "bafybeibendipv6yz5n6ozh6lxlrun4xshosz2lfxjzsue4pqyjq2tjank4",

  // prettier-ignore
  [
    // Zip Block Comprised of existing directory blocks
    ["QmdEkWCJdUbvvDPx64K9FvLL1CUBWhou2Y6pcbW1D41jAw", 47],
    ["bafybeihqptzlm43udmr2riplqtgxa4brx2thqnl7hpjsfn3rtgtjfrowya", 552683], // archive/iana.warc
    ["QmTBTjoxoV7CbPwJvxNRs7qLgR7yfzdRkEgBDxQCtzTs7A", 69],
    ["bafkreiftimfhuhoqkjjsoa62szrjkeu57f5qbbruj2t5ilxv3azds3jjmi", 675],    // datapackage-digest.json
    ["QmY6MrCAnhkWDu4eM2MLFecV35ybe916QEDXK3NpnpCzqJ", 62],
    ["bafkreigy4p4k56qj3vg5nczznv4x7kmfygete37qg2vbmkrj2cfezco4cm", 817],    // datapackage.json
    ["QmfDgn3GRQ6xy14X8Zw9CpURV25jBYp79NFZJTrRYQBGZ1", 63],
    ["bafkreibgqhyupecf3om6wrya5hp6gflzey345qrb5nl2zcipx5ru5smiey", 5866],   // indexes/iana.cdxj
    ["QmNUe14jLedWdcQ2chSuY79DFCNa7ujtzsAEXRqVvyJ1Za", 63],
    ["bafkreifragagtvk3w6dplny5pfjeurkeyvqccf5amlw7huzj4ndiu3g6yi", 1746],   // pages/pages.jsonl
    ["QmUGb1y2BmLVo37SbxSR2M28bqq69tDn625xiumFqQMMWh", 358],
  ]
);
