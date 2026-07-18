// @ts-check

const { build, context } = require("esbuild");

const args = process.argv.slice(2);
const isProduction = args.includes("--production");

/** @typedef {import('esbuild').BuildOptions} BuildOptions **/

/** @type BuildOptions */
const baseConfig = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
};

// Config for extension source code (to be run in a Node-based context)
/** @type BuildOptions */
const extensionConfig = {
  ...baseConfig,
  platform: "node",
  mainFields: ["module", "main"],
  format: "cjs",
  entryPoints: ["./src/extension.ts"],
  outfile: "./out/extension.js",
  external: ["vscode"],
};

// Config for webview source code (to be run in a web-based context)
/** @type BuildOptions */
const webviewConfig = {
  ...baseConfig,
  target: "es2020",
  format: "esm",
  entryPoints: ["./src/webview/main.ts"],
  outfile: "./out/webview.js",
};

/** @type BuildOptions */
const testConfig = {
  ...baseConfig,
  platform: "node",
  format: "cjs",
  entryPoints: ["./src/model/DagModel.test.ts"],
  outfile: "./.test-out/DagModel.test.js",
};

/** @type BuildOptions */
const integrationTestRunnerConfig = {
  ...baseConfig,
  platform: "node",
  format: "cjs",
  entryPoints: ["./src/test/runTest.ts"],
  outfile: "./.test-out/integration/runTest.js",
  external: ["@vscode/test-electron"],
};

/** @type BuildOptions */
const integrationTestSuiteConfig = {
  ...baseConfig,
  platform: "node",
  format: "cjs",
  entryPoints: ["./src/test/suite/index.ts"],
  outfile: "./.test-out/integration/suite/index.js",
  external: ["vscode"],
};

/** @type {import("esbuild").Plugin} */
const watchReporter = {
  name: "watch-reporter",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      for (const error of result.errors) {
        const location = error.location;
        const prefix = location ? `${location.file}:${location.line}:${location.column}: ` : "";
        console.error(`> ${prefix}error: ${error.text}`);
      }
      if (result.errors.length === 0) {
        console.log("[watch] build finished");
      }
    });
  },
};

/** @param {BuildOptions} config */
async function watch(config) {
  const buildContext = await context({
    ...config,
    plugins: [...(config.plugins ?? []), watchReporter],
  });
  await buildContext.watch();
  return buildContext;
}

// Build script
(async () => {
  try {
    if (args.includes("--test")) {
      await build(testConfig);
      console.log("test build complete");
    } else if (args.includes("--integration-test")) {
      await build(integrationTestRunnerConfig);
      await build(integrationTestSuiteConfig);
      console.log("integration test build complete");
    } else if (args.includes("--watch")) {
      await Promise.all([watch(extensionConfig), watch(webviewConfig)]);
    } else {
      // Build extension and webview code
      await build(extensionConfig);
      await build(webviewConfig);
      console.log("build complete");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
})();
