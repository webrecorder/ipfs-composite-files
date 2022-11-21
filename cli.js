#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { create as ipfsClientCreate } from "ipfs-http-client";
import { create as ipfsCreate } from "ipfs-core";
import { RealIPFSStore } from "./src/store.js";

import { CID } from "multiformats/cid";

import { concat, makeDir, addToDir } from "./src/concat.js";

import { splitAddWithSplitsFile } from "./cli-utils.js";

import { traverse, traverseDir, getStat } from "./src/traverse.js";

import { createZip } from "./src/zip.js";

import fsp from "fs/promises";

// ===========================================================================
export function main() {
  yargs(hideBin(process.argv))
    .usage("Usage: $0 [global-options] <command> [options]")
    .option("api", {
      default: "/ip4/127.0.0.1/tcp/5001",
      describe: "If specified, connect to remote IPFS node",
    })
    .option("repo", { describe: "If specified, use local (js-ipfs) repo" })

    .command(
      "concat [cids..]",
      "concat multiple files into a single file, like 'cat'",
      (yargs) => {
        yargs.demandOption("cids");
      },
      runConcat
    )

    .command(
      "add <contentFilename> <splitFilename>",
      "add <contentFilename> to IPFS as concatenated parts, split at split points read from <splitFilename>",
      () => {},
      runSplitAdd
    )

    .command(
      "show-ranges <cid> [depth]",
      "show ranges of composite file represented by <cid>, print each leaf CID and the range it represents",
      (yargs) => {
        yargs.positional("depth", {
          describe:
            "max depth to descend into tree, use 1 to only show composite file",
          type: "number",
          default: 1,
        });
      },
      runShowRanges
    )

    .command(
      "make-dir [files..]",
      "create directory containing list of 'name=cid'",
      (yargs) => {
        yargs.demandOption("files");
      },
      runMakeDir
    )

    .command(
      "add-to-dir <cid> [files..]",
      "add list of cids 'name=cid' existing directory",
      (yargs) => {
        yargs.demandOption("files");
      },
      runAddToDir
    )

    .command(
      "walk-dir <cid>",
      "walk directory represented by <cid> recursively",
      () => {},
      runWalkDir
    )

    .command(
      "zip-dir <cid>",
      "Create a ZIP file of existing directory (uncompressed), reusing the directory data",
      () => {},
      runZipDir
    )

    .command(
      "stat <cidpath>",
      "Get stats of a root CID or path string. Can be <cid> or <cid>/path/to/file",
      () => {},
      runStat
    )

    .demandCommand(1).argv;
}

// ===========================================================================
async function initIPFS(argv) {
  let ipfs;

  if (argv.repo) {
    ipfs = await ipfsCreate({ offline: true, repo: argv.repo });
  } else if (argv.api) {
    ipfs = await ipfsClientCreate({ url: argv.api });
  } else {
    ipfs = await ipfsCreate({ offline: true });
  }

  return new RealIPFSStore(ipfs);
}

// ===========================================================================
async function runConcat(argv) {
  const ipfs = await initIPFS(argv);

  const result = await concat(
    ipfs,
    argv.cids.map((cid) => CID.parse(cid))
  );

  console.log(result.toV1());
}

// ===========================================================================
async function runMakeDir(argv) {
  const ipfs = await initIPFS(argv);

  const files = {};
  for (const namecid of argv.files) {
    const [name, cid] = namecid.split("=");
    files[name] = {
      cid: CID.parse(cid),
    };
  }

  const result = await makeDir(ipfs, files);

  console.log(result.toV1());
}

// ===========================================================================
async function runAddToDir(argv) {
  const ipfs = await initIPFS(argv);

  const files = {};
  for (const namecid of argv.files) {
    const [name, cid] = namecid.split("=");
    files[name] = {
      cid: CID.parse(cid),
    };
  }

  const result = await addToDir(ipfs, CID.parse(argv.cid), files);

  console.log(result.toV1());
}

// ===========================================================================
async function runSplitAdd(argv) {
  const ipfs = await initIPFS(argv);

  const { cid } = await splitAddWithSplitsFile(
    ipfs,
    argv.contentFilename,
    argv.splitFilename,
    {},
    ({ cid, offset, length, totalSize } = {}) =>
      console.log(`added [${offset}, ${offset + length}) of ${totalSize}`)
  );

  console.log(cid.toV1());
}

// ===========================================================================
async function runShowRanges(argv) {
  const ipfs = await initIPFS(argv);

  const cid = CID.parse(argv.cid);

  for await (const entry of traverse(ipfs, cid, argv.depth)) {
    console.log(
      `${entry.cid.toV1()}: [${entry.offset}, ${
        entry.offset + entry.length
      }) size: ${entry.length}`
    );
  }
}

// ===========================================================================
async function runWalkDir(argv) {
  const ipfs = await initIPFS(argv);

  const cid = CID.parse(argv.cid);

  for await (const entry of traverseDir(ipfs, cid)) {
    console.log(`${entry.cid.toV1()}: "${entry.name}" - ${entry.size}`);
  }
}

// ===========================================================================
async function runStat(argv) {
  const ipfs = await initIPFS(argv);

  const entry = await getStat(ipfs, argv.cidpath);

  if (entry) {
    console.log(`${entry.cid.toV1()}: "${entry.name}" - ${entry.size}`);
  } else {
    console.log("Not Found!");
  }
}

// ===========================================================================
async function runZipDir(argv) {
  const ipfs = await initIPFS(argv);

  const cid = CID.parse(argv.cid);

  const finalCid = await createZip(ipfs, cid);
  console.log("zip cid", finalCid);
}

main();
