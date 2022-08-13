## IPFS Composite File Utilities

This repo provides several cli/api utilities for js-ipfs to create and work with composite files, files created
by concatenating smaller files which are still referenced on IPFS.

In particular, it provides a way to add a file to IPFS, split at least at the designated split offsets.

The split offsets can be loaded from a separate file.

### Web Archiving Using Cases

This use cases is particularly useful for adding WARC files to IPFS, split at WARC record boundaries:

```
> cdxj-indexer my-warc.warc.gz > my-warc.cdxj

> node cli.js add my-warc.warc.gz my-warc.cdxj
...
final cid: <CID>

```

The final CID printed will point to the full WARC on IPFS, split at the offset boundaries in the CDXJ. The CID of each WARC record will be printed as well. Each WARC record has a CID on IPFS and can be deduplicated, as well as the full WARC file.

## CLI Commands

By default, commands use the IPFS API on default port (5001. The) `--api` flag can be used to connect to a different API endpoint.


### concat

The `concat` command is the core features that allows concatenating files 1 ... N which have already been added to IPFS (and each have an IPFS CID) into a new file
by creating a new tree simply linking the files together

`node cli.js concat <CID 1> ... <CID N>` - concatenate files 1 ... N


### add

The add command 

`node cli.js add <contentFilename> <splitsFilename>` - add file `contentFilename` split along points listed in `splitsFilename`.

The splitsFilename can be a CSV, JSON-lines or CDXJ files.

### show-ranges

`node cli.js show-ranges <CID> [depth]` - inspect a file and print ranges of file and CID that corresponds to those ranges.

By default, with a depth of 1, the show-ranges command will show one layer in the IPFS DAG, outputting the direct members of a composite files.
The a higher depth, the command will print the full tree of an IPFS file DAG.



