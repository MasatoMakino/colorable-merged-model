/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom",
  collectCoverageFrom: ["src/**/*.ts"],
  transform: {
    "\\.[jt]sx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
    "node_modules/(three/examples/|@masatomakino/tweenable-color/esm/).+.(j|t)sx?$":
      [
        "ts-jest",
        {
          useESM: true,
        },
      ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  transformIgnorePatterns: [
    "/node_modules/(?!three/examples/|@masatomakino/tweenable-color/esm/)",
  ],
};
