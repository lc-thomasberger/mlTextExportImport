var util = require("util");
var path = require("path");
var fs = require("fs");
var _ = require("underscore");

/*
  arguments
  --files="articles_export_de.csv,blocks_export_de.csv,components_export_de.csv,contentObjects_export_de.csv,course_export_de.csv
  --targetLang="de"
  --masterLang="en"
  --csvDelimiter=";"

  todo:
    - add _languages attribute to course Data
    - add support for config in adapt.json
*/

module.exports = function (grunt) {
  
  grunt.registerTask("ml-import", "Duplicate a course by importing Languagefiles", function () {

    var srcPath = grunt.config("sourcedir");
    
    var langFiles = grunt.option("files");
    var masterLang = grunt.option("masterLang") || "en";
    var targetLang = grunt.option("targetLang");
    var csvDel = grunt.option("csvDelimiter") || ";";
    var csvEol = "\n";
    
    var _importData = [];
    var _courseData = {};

    checkConfig();
    copyCourse();
    readLangFiles();
    processLangFiles();
    getCourseDate();
    replaceCourseData();
    saveCourseData();

    function checkConfig () {
      var adaptConfig = grunt.file.readJSON("adapt.json");
      
      if (adaptConfig.hasOwnProperty("multilang")) {
        if (!grunt.option('masterLang') && adaptConfig.multilang.hasOwnProperty("masterLanguage")) {
          if (adaptConfig.multilang.masterLanguage) {
            masterLang = adaptConfig.multilang.masterLanguage;
          }
        }
        if (!grunt.option('csvDelimiter') && adaptConfig.multilang.hasOwnProperty("csvDelimiter")) {
          if (adaptConfig.multilang.csvDelimiter) {
            csvDel = adaptConfig.multilang.csvDelimiter;
          }
        }
        if (!grunt.option('files') && adaptConfig.multilang.hasOwnProperty("files")) {
          if (adaptConfig.multilang.files[targetLang]) {
            langFiles = adaptConfig.multilang.files[targetLang];
          }
        }
      }
    }

    function copyCourse () {
      grunt.file.copy(path.join(srcPath,"course",masterLang,"course.json"), path.join(srcPath,"course",targetLang,"course.json"));
      grunt.file.copy(path.join(srcPath,"course",masterLang,"contentObjects.json"), path.join(srcPath,"course",targetLang,"contentObjects.json"));
      grunt.file.copy(path.join(srcPath,"course",masterLang,"articles.json"), path.join(srcPath,"course",targetLang,"articles.json"));
      grunt.file.copy(path.join(srcPath,"course",masterLang,"blocks.json"), path.join(srcPath,"course",targetLang,"blocks.json"));
      grunt.file.copy(path.join(srcPath,"course",masterLang,"components.json"), path.join(srcPath,"course",targetLang,"components.json"));
    }
  
    function readLangFiles () {
      
      // check if files exist
      if (typeof langFiles === "string") {
        langFiles = langFiles.split(",");
      }
      
      for (var i = 0; i < langFiles.length; i++) {
        if (!grunt.file.exists("languagefiles", langFiles[i])) {
          throw grunt.util.error(langFiles[i] + " not found");
        } else {
          langFiles[i] = path.join("languagefiles",langFiles[i]);
        }
      }
    }
  
    function _parseCsvFiles () {
      var content = "";
      langFiles.forEach(function (file) {
        content += grunt.file.read(file);
        content += csvEol;
      });
      
      // line: file/id/*paht;value \n
      var lines = content.split(csvEol);
      
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].split(csvDel);
        var value = line[1];
        var key = line[0].split("/");
        var file = key[0];
        var id = key[1];
        var path = key.slice(2).join("/");
        
        if (line.length === 2) {
          _importData.push({
            file: file,
            id: id,
            path: "/"+path,
            value: value
          });
        }
      }
    }
  
    function _parseJsonFile () {
      // check if valid raw format
      _importData = grunt.file.readJSON(langFiles[0]);
      var item = _importData[0];
      var isValid = item.hasOwnProperty("file") && item.hasOwnProperty("id") && item.hasOwnProperty("path") && item.hasOwnProperty("value");
      
      if (!isValid) {
        throw grunt.util.error("Sorry, the imported Files are not valid");
      }
    }
    
    function processLangFiles () {
      var format = path.parse(langFiles[0]).ext;
      
      switch (format) {
        case ".csv":
          _parseCsvFiles();
          break;
        
        default:
          _parseJsonFile();
          break;
      }
      
      _importData = _.sortBy(_importData, "file");
    }

    function getCourseDate () {
      ["course", "contentObjects", "articles", "blocks", "components"].forEach(function (filename) {
        var src = path.join(srcPath,"course",targetLang,filename+".json");
        
        _courseData[filename] = {};
        _courseData[filename] = grunt.file.readJSON(src);
      });
    }
  
    function saveCourseData () {
      ["course", "contentObjects", "articles", "blocks", "components"].forEach(function (filename) {
        var src = path.join(srcPath,"course",targetLang,filename+".json");

        grunt.file.write(src, JSON.stringify(_courseData[filename],"",4));
      });
    }
    
    function _replaceData (isCollection, data) {
      
      if (isCollection) {
        var index = _courseData[data.file].findIndex(function (item) {
          return item._id === data.id;
        });
        _setValueByPath(_courseData[data.file][index], data.value, data.path);
      } else {
        _setValueByPath(_courseData[data.file], data.value, data.path);
      }
    }
    
    function _setValueByPath (obj, value, path) {
      path = path.split("/").slice(1,-1);
      for (i = 0; i < path.length - 1; i++)
          obj = obj[path[i]];

      obj[path[i]] = value;
    }
    
    function replaceCourseData () {
          
      for (var i = 0; i < _importData.length; i++) {
        if (_importData[i].file === "course") {
          _replaceData(false, _importData[i]);
        } else {
          _replaceData(true, _importData[i]);
        }
      }
    }

  });
};