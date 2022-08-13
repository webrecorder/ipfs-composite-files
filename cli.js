import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { create as ipfsClientCreate } from 'ipfs-http-client';
import { create as ipfsCreate } from "ipfs-core";

import { CID } from 'multiformats/cid';

import { concat } from "./src/concat.js";

import { splitAdd, parseSplitsFile } from "./src/split-add.js";

import { traverse } from "./src/traverse.js";
import fsp from "fs/promises";


function main() {
  yargs(hideBin(process.argv))
  .usage("Usage: $0 [global-options] <command> [options]")
  .option("api", {default: "/ip4/127.0.0.1/tcp/5001"})

  .command("concat [cids..]", "concat multiple files into a single file, like 'cat'", (yargs) => {
    yargs.demandOption("cids")
  }, runConcat)

  .command("add <contentFilename> <splitFilename>", "add <contentFilename> to IPFS as concatenated parts, split at split points read from <splitFilename>", () => {},
  runSplitAdd)

  .command("show-ranges <cid> [depth]", "show ranges of composite file represented by <cid>, print each leaf CID and the range it represents", (yargs) => {
    yargs.positional("depth", {
      describe: "max depth to descend into tree, use 1 to only show composite file",
      type: "number",
      default: 1
    })
  }, runShowRanges)

  .demandCommand()
  .argv;
}

async function initIPFS(argv) {
  if (argv.api) {
    return await ipfsClientCreate({url: argv.api});
  } else {
    return await ipfsCreate({offline: true});
  }
}

async function runConcat(argv) {
  const ipfs = await initIPFS(argv);

  const result = await concat(ipfs, argv.cids.map(cid => CID.parse(cid)));

  console.log(result.toV1());
}

async function runSplitAdd(argv) {
  const ipfs = await initIPFS(argv);

  const offsets = parseSplitsFile(await fsp.readFile(argv.splitFilename, {encoding: "utf8"}));

  let lastEntry = null;

  for await (const entry of splitAdd(ipfs, argv.contentFilename, offsets)) {
    console.log(`added [${entry.offset}, ${entry.offset + entry.length}) of ${entry.totalSize}`);
    lastEntry = entry;
  }

  console.log(`final composite file: ${lastEntry.cid}`);
}

async function runShowRanges(argv) {
  const ipfs = await initIPFS(argv);

  const cid = CID.parse(argv.cid);

  for await (const entry of traverse(ipfs, cid, argv.depth)) {
    console.log(`${entry.cid.toV1()}: [${entry.offset}, ${entry.offset + entry.length}) size: ${entry.length}`);
  }
}

main();
