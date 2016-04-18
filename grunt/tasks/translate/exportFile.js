var path = require("path");
var fs = require("fs");
var csv = require("csv");

module.exports = function (grunt) {
  
  grunt.registerTask("_exportLangFiles", function () {
    
    var next = this.async();
    
    grunt.file.mkdir("languagefiles");
    formatExport();
    
    
    
    function formatExport () {
      var filename = "export_"+grunt.config("translate.masterLang");
      
      switch (grunt.config("translate.format")) {
        case "csv":
          _exportCSV(filename);
          break;
        
        default:
          _exportRaw(filename);
          break;
      }
    }
    
    
    function _exportCSV (filename) {
      var inputs = global.translate.exportTextData.reduce(function (prev, current) {
        if (!prev.hasOwnProperty(current.file)) {
          prev[current.file] = [];
        }
      
        prev[current.file].push([current.file+'/'+current.id+current.path, current.value]);
        return prev;
      }, {});
      
      var files = Object.keys(inputs);
      var counter = 0;
      var options = {
        delimiter: grunt.config("translate.csvDelimiter")
      };
      
      var courseCsv = fs.createWriteStream(path.join("languagefiles","course_"+filename+".csv"));
      var coCsv = fs.createWriteStream(path.join("languagefiles","contentObjects_"+filename+".csv"));
      var aCsv = fs.createWriteStream(path.join("languagefiles","articles_"+filename+".csv"));
      var bCsv = fs.createWriteStream(path.join("languagefiles","blocks_"+filename+".csv"));
      var cCsv = fs.createWriteStream(path.join("languagefiles","components_"+filename+".csv"));
      
      courseCsv.once("finish", _onFinish);
      coCsv.once("finish", _onFinish);
      aCsv.once("finish", _onFinish);
      bCsv.once("finish", _onFinish);
      cCsv.once("finish", _onFinish);
      
      csv.stringify(inputs.course, options).pipe(courseCsv);
      csv.stringify(inputs.contentObjects, options).pipe(coCsv);
      csv.stringify(inputs.articles, options).pipe(aCsv);
      csv.stringify(inputs.blocks, options).pipe(bCsv);
      csv.stringify(inputs.components, options).pipe(cCsv);
      
      function _onFinish () {
        counter++;
        if (counter == files.length) {
          next();
        }
      }
    }
    
    function _exportRaw (filename) {
      grunt.file.write(path.join("languagefiles",filename+".json"), JSON.stringify(global.translate.exportTextData," ", 4));
      next();
    }
    
  });
  
};

/*

global.translate.exportTextData = [
  {
    "file": "course",
    "id": "course",
    "path": "/title",
    "value": "Adapt Version 2.0 demonstartion"
  },
  {
    "file": "course",
    "id": "course",
    "path": "/displayTitle",
    "value": "Adapt Version 2.0 demonstration"
  }
]

*/