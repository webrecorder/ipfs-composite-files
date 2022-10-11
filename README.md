## IPFS Composite File Utilities

This repo provides several cli/api utilities for js-ipfs to create and work with composite files, files created
by concatenating smaller files which are previous already add to IPFS.

Install with `npm i -g ipfs-composite-files`. This will add a global `ipfs-composite-files` command.

The core of this repo is to provide a way to create a composite file IPFS, split at least at the designated split offsets instead of in equal chunks. The split offsets can be loaded from a separate file.

### Applications for Web Archives (WARC and WACZ storage).

#### Storing WARC files

This use cases is particularly useful for adding WARC files to IPFS, split at WARC record boundaries.

A [CDXJ](https://specs.webrecorder.net/cdxj/0.1.0/) index can be used to specify split points, read from the `"offset"` field in each CDXJ line.

```

> ipfs-composite-files add my-archive.warc.gz my-archive.cdxj
...
final cid: <CID>

```

(A CDXJ index can be generated using [cdxj-indexer](https://github.com/webrecorder/cdxj-indexer) or [https://github.com/webrecorder/warcio.js](warcio.js) tools by running either `cdxj-indexer my-archive.warc > my-archive.cdxj` or `warcio.js cdx-index my-archive.warc > my-archive.cdxj`).

The final CID printed will point to the full WARC on IPFS, split at the offset boundaries in the CDXJ. The CID of each WARC record will be printed as well. Each WARC record has a CID on IPFS and can be deduplicated, as well as the full WARC file.

#### Storing WACZ files

The [WACZ](https://specs.webrecorder.net/wacz/latest/) format contains WARC files, CDXJ and additional metadata all stored in a ZIP file, uncompressed.

The [in-place ZIP creation](#in-place-zip) allows for a WACZ file to exist as a regular IPFS directory, as well as a ZIP file, reusing the same data, allowing for the contents of the WACZ to exist as both ZIPed and unzipped, allowing for easier access and deduplication.



## CLI Commands -- Files

By default, commands use the IPFS API on default port (5001. The) `--api` flag can be used to connect to a different API endpoint.

To use a local js-ipfs repo, pass a `--repo <path>` flag instead.


### concat

The `concat` command is the core features that allows concatenating files 1 ... N which have already been added to IPFS (and each have an IPFS CID) into a new file
by creating a new tree simply linking the files together

`ipfs-composite-files concat <CID 1> ... <CID N>` - concatenate files 1 ... N


### add

The add command 

`ipfs-composite-files add <contentFilename> <splitsFilename>` - add file `contentFilename` split along points listed in `splitsFilename`.

The splitsFilename can be a CSV, JSON-lines or CDXJ files.

### show-ranges

`ipfs-composite-files show-ranges <CID> [depth]` - inspect a file and print ranges of file and CID that corresponds to those ranges.

By default, with a depth of 1, the show-ranges command will show one layer in the IPFS DAG, outputting the direct members of a composite files.
With a higher depth, the command will print the full tree of an IPFS file DAG.

## CLI Commands -- Directories

This library also includes commands for working with directories, including:

### make-dir

`ipfs-composite-files make-dir [name1=cid1] ... [nameN=cidN]` - create a new directory which contains the named files with the given CIDs

### add-to-dir

`ipfs-composite-files add-to-dir <dirCid> [name1=cid1] ... [nameN=cidN]` - add list of named files (name=cid format) to existing directory

### walk-dir

`ipfs-composite-files walk-dir <cid>` - walks directory recursively, printing name of each CID, name and size contained.

### zip-dir

`ipfs-composite-files zip-dir <cid>` - creates a ZIP containing the contents of the directory in place (see below).


## In-place ZIP

An experimental feature is creating a ZIP file by concatenating the files in an existing directory with ZIP file entry metadata. The ZIP file is uncompressed and reuses the contents of the directory, so that the ZIP is effectively deduplicated against the directory. 

This is possible due to the properties of the ZIP format, including support for uncompressed data, and can be useful for distributing
data as ZIP for portability (eg. WACZ format) / export outside of IPFS but keeping the data separate for deduplication.


For example, given a directory structure with 3 files, stored under a CID A, CID B, CID C:

```
     CID DIR
CID A: ├── afile.txt
       ├── sample-dir  
CID B: │   └── data.bin
CID C: ├── somefile.txt
```

A ZIP file can reuse this data by concatenating each file with the ZIP entries created by the zipping process.
A final ZIP file may consist of:
```
CID Z
  ├── CID Z0
  ├── CID A    afile.txt
  ├── CID Z1
  ├── CID B    sample-dir/data.bin
  ├── CID Z2
  ├── CID C    somefile.txt
  ├── CID Z3
```

The `ipfs-composite-files zip-dir <CID DIR>` would create and add to IPFS cids `CID Z0...Z3` and output `CID Z`.

The end result is that `cat <CID Z> == cat <CID Z0> <CID A> <CID Z1> <CID B> <CID Z2> <CID C> <CID Z3>`.

See the tests in [test/fileDirApi.js](test/fileDirApi.js) for a specific example.


## API

ipfs-composite-files can also be used as an API, including in the browser. Use ``npm build`` to build a browser-compatible version of the library.

The built file, `./dist/ipfsCompositeFiles.js`, can then be loaded directly in the browser. Note that the `ipfs-core` library
must also be loaded, and is not packaged with this build.

The library exports all the functions as listed in [src/index.js](src/index.js) via the `self.ipfsCompositeFiles` global.

An example usage in the browser, along with `ipfs-core`:

```html
<script src="https://cdn.jsdelivr.net/npm/ipfs-core/dist/index.min.js"></script>
<script src="./dist/ipfsCompositeFiles.js"></script>
<script>

async function main() {
  const ipfs = await self.IpfsCore.create(await self.ipfsCompositeFiles.createInMemoryRepo());

  const A = await ipfs.add("abc");

  const B = await ipfs.add("def");

  const C = await self.ipfsCompositeFiles.concat(ipfs, [A.cid, B.cid]);

  for await (const chunk of ipfs.cat(C)) {
    console.log(chunk);
  }
}
```
 
## Tests

Tests are located in `./test` and can be run with `npm test`. (The tests use a temporary js-ipfs repo).


