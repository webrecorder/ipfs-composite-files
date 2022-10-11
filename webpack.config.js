export default {
  output: {
    library: {
      name: "ipfsCompositeFiles",
      type: "self",
    },
    filename: "ipfsCompositeFiles.js"
  },
  resolve: {fallback: { "util": false } }
};
