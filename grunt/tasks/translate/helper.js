module.exports = function (grunt) {
  
  global.translate = {};
  
  var exports = {};
  
  exports.loadSubTasks = function () {
    require("./loadTranslateConfig.js")(grunt);
    require("./loadCourseData.js")(grunt);
    require("./createLookupTable.js")(grunt);
    require("./exportFile.js")(grunt);
    require("./extractCourseData.js")(grunt);
    require("./parseSchema.js")(grunt);
  };
  
  exports.modelTypeMap = {
    "config": "config",
    "course": "course",
    "contentObjects": "contentobject",
    "articles": "article",
    "blocks": "block",
    "components": "component"
  };
  
  
  return exports;

};
