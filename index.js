import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { create as ipfsClientCreate } from 'ipfs-http-client';
import { create as ipfsCreate } from "ipfs-core";

import { CID } from 'multiformats/cid';

import { concat } from "./src/concat.js";


function main() {
  yargs(hideBin(process.argv))
  .usage("Usage: $0 [global-options] <command> [options]")
  .option("api")
  .command("concat [cids..]", "concat multiple files into a single file, like 'cat'", (yargs) => {
    yargs.demandOption("cids")
  }, runConcat)
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

main();
