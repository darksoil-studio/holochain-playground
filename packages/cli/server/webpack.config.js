const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const webpackPath = require('webpack-path-resolve');
require('dotenv').config();

const resolve = webpackPath.resolve(require.resolve.paths);

module.exports = {
	entry: './src/index.ts',
	target: 'node',
	mode: process.env.NODE_ENV,
	devtool:
		process.env.NODE_ENV === 'development' ? 'eval-source-map' : 'source-map',
	watchOptions: {},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.m?js$/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env'],
					},
				},
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
	output: {
		globalObject: 'this',
		filename: 'app.js',
		path: path.resolve(__dirname, 'dist'),
	},
	node: {
		global: false,
		__filename: false,
		__dirname: false,
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{
					from: `${resolve('@holochain-playground/cli-client')}/dist`,
					to: './public/',
				},
			],
		}),
		new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
	],
};
