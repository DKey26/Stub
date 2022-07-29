const path = require('path');
const fs = require('fs');
const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');

let isDevelopment;

const PATHS = {
  postCSSConfig: path.join(__dirname, 'postcss.config.js'),

  src: path.join(__dirname, 'src'),
  dist: path.join(__dirname, 'build'),
  pages: path.join(__dirname, 'src/views'),

  cssTo: 'css',
  imagesFrom: 'src/assets/images',
  imagesTo: 'images',
  iconsFrom: 'assets/icons',
  iconsTo: 'icons',
  fontsFrom: 'src/assets/fonts',
  fontsTo: 'fonts',
  javaScriptTo: 'js',
}

function GetProjectPages(dir) {
  const pagesInfo = fs.readdirSync(dir).map((pagefolder) => {
    const file = fs.readdirSync(path.join(dir, pagefolder)).filter((filename) => {
      return filename.endsWith('.pug');
    })[0];

    return { foldername: pagefolder, pagename: file };
  });

  return pagesInfo;
}

const generateHtmlPlugin = (foldername, pagename) => {
  return new HtmlWebpackPlugin({
      filename: pagename.replace(/\.pug/, '.html'),
      template: path.join(PATHS.pages, foldername, pagename),
      inject: 'body'
  });
}

const generateHtmlPlugins = (pagesInfo) => {
  plugins = [];
  pagesInfo.forEach(({foldername, pagename}) => {
      plugins.push(generateHtmlPlugin(foldername, pagename));
  })
  return plugins;
}

function getLoaders(){
  return {
      rules: [
          {
              test: /\.pug$/,
              use: [
                  {
                      loader: 'pug-loader',
                      options: {
                          pretty: true
                      },
                  },
                  
              ]
          },
          {
              test: /\\.(js|jsx)$/,
              loader: 'babel-loader',
          },
          {
              test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
              loader: 'file-loader',
              options: {
                  name: `${PATHS.fontsTo}/[name].[ext]`
              }
          },
          {
              test: /\.(png|jpg|gif|svg)$/,
              loader: 'file-loader',
              options: {
                  name: `${PATHS.imagesTo}/[name].[ext]`
              }
          },
          {
              test: /\.scss$/i,
              use: [
                  'style-loader',
                  {
                      loader: MiniCssExtractPlugin.loader,
                      options: {
                          publicPath: '../',
                          esModule: false,
                      }
                  },
                  {
                      loader: "css-loader",
                      options: {
                          sourceMap: isDevelopment
                      }
                  },
                  {
                      loader: 'postcss-loader',
                      options: {
                        sourceMap: isDevelopment,
                        postcssOptions: {
                          path: PATHS.postCSSConfig
                        }
                      }
                  },
                  {
                      loader: 'sass-loader',
                      options: {
                        sourceMap: isDevelopment
                      }
                  }
              ],
          },
          {
              test: /\.css$/,
              use: [
                  'css-loader',
                  MiniCssExtractPlugin.loader,
                  {
                      loader: 'postcss-loader',
                      options: {
                          sourceMap: isDevelopment,
                          postcssOptions: {
                              config: PATHS.postCSSConfig
                          },
                      }
                  },
              ]
          },
      ],
  };
}

function getPlugins(pagesInfo) {
  const plugins = [
      new CleanWebpackPlugin(),

      ...generateHtmlPlugins(pagesInfo),

      new MiniCssExtractPlugin({
          filename: `${PATHS.cssTo}/[name].css`
      }),

      new webpack.ProvidePlugin({
          $: "jquery",
          "window.$": "jquery",
          jQuery: "jquery",
          "window.jQuery": "jquery",
      }),

      new CopyWebpackPlugin({
          patterns: [
              {
                  from: path.join(__dirname, PATHS.imagesFrom),
                  to: PATHS.imagesTo,
                  noErrorOnMissing: true
              }, 
              {
                  from: path.join(__dirname, PATHS.iconsFrom),
                  to: PATHS.iconsTo,
                  noErrorOnMissing: true
              },
              {
                  from: path.join(__dirname, PATHS.fontsFrom),
                  to: PATHS.fontsTo,
                  noErrorOnMissing: true
              },
          ]
      }),
  ];

  return plugins;
}

function buildConfig(mode){
  const pagesInfo = GetProjectPages(PATHS.pages);

  const config = {
      mode,
      entry: path.join(__dirname, 'src/js/index.js'),
      output: {
          filename: `${PATHS.javaScriptTo}/[name].js`,
          path: PATHS.dist,
      },

      optimization: {
          splitChunks: {
              cacheGroups: {
                  vendor: {
                      name: 'vendors',
                      test: /(node_modules|libs)/,
                      chunks: 'all',
                      enforce: true
                  }
              }
          }
      },

      resolve: {
          alias: {
              '@': PATHS.src,
          }
      },

      plugins: getPlugins(pagesInfo),
      module: getLoaders()
  }

  if(isDevelopment){
      const devServer = {
          contentBase: PATHS.dist,
          writeToDisk: true,
          hot: true,
          open: true,
          port: 8080,
          overlay: {
              warnings: true,
              errors: true
          }
      };
      config.devServer = devServer;
  }

  return config;
}

module.exports = (env, argv) => {
  let mode = argv.mode;
  isDevelopment = mode === 'development';
  return buildConfig(mode);
}