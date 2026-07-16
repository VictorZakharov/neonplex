const path = require('node:path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');

/** @returns {import('webpack').Configuration} */
module.exports = (_environment, arguments_) => {
  const production = arguments_.mode === 'production';
  const plugins = [
    new webpack.DefinePlugin({
      __NEONPLEX_PWA__: JSON.stringify(production),
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/pwa/manifest.webmanifest', to: 'manifest.webmanifest' },
        { from: 'src/pwa/icons', to: 'icons' },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      title: 'NEONPLEX // SYSTEM BREACH',
    }),
  ];

  if (production) {
    plugins.push(
      new GenerateSW({
        cacheId: 'neonplex',
        clientsClaim: true,
        exclude: [/\.map$/],
        inlineWorkboxRuntime: true,
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        skipWaiting: true,
        sourcemap: false,
        swDest: 'service-worker.js',
      }),
    );
  }

  return {
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'neonplex.[contenthash].js',
      clean: true,
      publicPath: 'auto',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: 'ts-loader',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|webp)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins,
    devServer: {
      static: path.resolve(__dirname, 'dist'),
      port: 8080,
      hot: true,
      historyApiFallback: true,
    },
    devtool: 'source-map',
    performance: {
      hints: false,
    },
  };
};
