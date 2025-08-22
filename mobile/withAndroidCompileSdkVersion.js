const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidCompileSdkVersion(config) {
  return withProjectBuildGradle(config, config => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = config.modResults.contents.replace(
        /compileSdkVersion = \d+/,
        'compileSdkVersion = 33'
      );
    } else {
      throw new Error(
        'Cannot set compileSdkVersion in MainApplication.java because it is not groovy'
      );
    }
    return config;
  });
};
