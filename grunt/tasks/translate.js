module.exports = function(grunt) {
  
    var Helper = require("./translate/helper.js")(grunt);
    Helper.loadSubTasks();

    grunt.registerTask('translate:export', 'Export Course Data into Language files ready to be translated', [
      "_loadTranslateConfig",
      "_loadCourseData",
      "_parseSchemaFiles",
      "_createLookupTables",
      "_extractCourseData",
      "_exportLangFiles"
    ]);
};
