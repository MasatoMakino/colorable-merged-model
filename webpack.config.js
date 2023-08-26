import path from "path";

const defaultOption = {
  mode: "production",
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          configFile: "tsconfig.worker.json",
          onlyCompileBundledFiles: true,
        },
      },
    ],
  },
  resolve: {
    extensions: [".ts"],
  },
};

export default (srcDir, distDir, prefix) => {
  return {
    entry: "./src/EdgeWorker.ts",
    output: {
      path: path.resolve(process.cwd(), "dist"),
      filename: "EdgeWorker.js",
    },
    ...defaultOption,
  };
};
