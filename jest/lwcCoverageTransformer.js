/**
 * The LWC jest transformer does not hook up istanbul, so `--coverage` reports 0%
 * for every file it compiles. This wrapper runs the LWC transform first and then
 * instruments the result, which is exactly what babel-jest does for plain files.
 */
const babelCore = require('@babel/core');
const istanbulPlugin = require('babel-plugin-istanbul').default;
const lwcTransformer = require('@lwc/jest-transformer');

module.exports = {
    getCacheKey(...args) {
        return lwcTransformer.getCacheKey(...args) + '-istanbul';
    },

    process(src, filePath, config, transformOptions) {
        const transformed = lwcTransformer.process(
            src,
            filePath,
            config,
            transformOptions
        );

        if (!transformOptions || !transformOptions.instrument) {
            return transformed;
        }

        const code =
            typeof transformed === 'string' ? transformed : transformed.code;
        const map =
            typeof transformed === 'string' ? undefined : transformed.map;

        const instrumented = babelCore.transform(code, {
            filename: filePath,
            babelrc: false,
            configFile: false,
            sourceMaps: 'both',
            inputSourceMap: map || undefined,
            plugins: [[istanbulPlugin, { cwd: config.rootDir }]]
        });

        return { code: instrumented.code, map: instrumented.map };
    }
};
