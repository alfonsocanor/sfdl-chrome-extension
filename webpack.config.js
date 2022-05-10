const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const LwcWebpackPlugin = require('lwc-webpack-plugin');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const path = require('path');

module.exports = {
  entry: {
    popup:'./src/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
        {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader'
            ]
        },
        {
            test: /\.ttf$/,
            use: ['file-loader']
        },
        {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
            loader: './node_modules/babel-loader/lib/index.js',
            options: {
                plugins: [
                './node_modules/@babel/plugin-proposal-object-rest-spread/lib/index.js',
                './node_modules/@babel/plugin-syntax-class-properties/lib/index.js'
                ],
                babelrc: false
            }
            }
        },
        {
            test: /\.ts$/,
            exclude: /node_modules/,
            use: {
                loader: './node_modules/babel-loader/lib/index.js',
                options: {
                    plugins: [
                    './node_modules/@babel/plugin-syntax-class-properties/lib/index.js',
                    [
                        './node_modules/@babel/plugin-syntax-decorators/lib/index.js',
                        { decoratorsBeforeExport: true }
                    ]
                    ],
                    presets: [
                    './node_modules/@babel/preset-typescript/lib/index.js'
                    ]
                }
            }
        }
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json']
    },
  plugins: [
    new LwcWebpackPlugin(),
    new MonacoWebpackPlugin(),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
        template:'./src/popup.html',
        filename:'popup.html',
    }),  
    new HtmlWebpackPlugin({
        template:'./src/home.html',
        filename:'sfdl.html'
    }),
    new CopyPlugin({
      patterns: [
        { 
            from: 'public'
        },
        {
            from: 'src/slds',
            to: 'slds'
        },
        {
            from: 'src/resources',
            to: 'resources'
        },
        {
            from: 'src/background.js',
            to: 'background.js'
        }
    ],
  }),],
};