var util = require("util");
var path = require("path");
var fs = require("fs");
var _ = require("underscore");
var csv = require('csv');

/*
  todo:
    - remove config from file processing

  arguments:
    --masterLang="en"
    --format="csv"
    --csvDelimiter=";"
*/

module.exports = function (grunt) {

  grunt.registerTask("ml-export", "Export Text ready for translation", function () {
    
    var next = this.async();
    
    var srcPath = grunt.config("sourcedir");
    var lang = grunt.option("masterLang") || "en";
    var format = grunt.option("format") || "raw";
    var csvDel = grunt.option("csvDelimiter") || ",";
    var _courseData = {};
    var _schemaData = {};
    var _lookupTables = {};
    var _exportTextData = [];
    
    var modelTypeMap = {
      "config": "config",
      "course": "course",
      "contentObjects": "contentobject",
      "articles": "article",
      "blocks": "block",
      "components": "component"
    };


    checkConfig();
    getCourseData();
    getSchemaData();
    processGlobals(); // collect globals from components/menu/extensions and add to _courseData.models.course
    processPluginLocations(); //collect properties from extensions/menu/components and copy to _courseData.models.[location]
    createLookUpTables();
    processCourseData();
    grunt.file.mkdir("languagefiles");
    formatExport();

    function checkConfig () {
      var adaptConfig = grunt.file.readJSON("adapt.json");
      
      if (adaptConfig.hasOwnProperty("multilang")) {
        if (!grunt.option('masterLang') && adaptConfig.multilang.hasOwnProperty("masterLanguage")) {
          if (adaptConfig.multilang.masterLanguage) {
            lang = adaptConfig.multilang.masterLanguage;
          }
        }
        if (!grunt.option('csvDelimiter') && adaptConfig.multilang.hasOwnProperty("csvDelimiter")) {
          if (adaptConfig.multilang.csvDelimiter) {
            csvDel = adaptConfig.multilang.csvDelimiter;
          }
        }
      }
    }

    function getCourseData () {
      _courseData.config = grunt.file.readJSON(path.join(srcPath,"course","config.json"));
      _courseData.course = grunt.file.readJSON(path.join(srcPath,"course",lang,"course.json"));
      _courseData.contentObjects = grunt.file.readJSON(path.join(srcPath,"course",lang,"contentObjects.json"));
      _courseData.articles = grunt.file.readJSON(path.join(srcPath,"course",lang,"articles.json"));
      _courseData.blocks = grunt.file.readJSON(path.join(srcPath,"course",lang,"blocks.json"));
      _courseData.components = grunt.file.readJSON(path.join(srcPath,"course",lang,"components.json"));
    }
    
    function getSchemaData () {
      [
        {
          type: "models",
          globPattern: "core/*.schema",
          bowerAttr: false,
          schemaLabel: "models"
        },{
          type: "components",
          globPattern: "components/*/properties.schema",
          bowerAttr: "component",
          schemaLabel: "components"
        },{
          type: "extensions",
          globPattern: "extensions/*/properties.schema",
          bowerAttr: "targetAttribute",
          schemaLabel: "extensions"
        },{
          type: "menu",
          globPattern: "menu/*/properties.schema",
          bowerAttr: "targetAttribute",
          schemaLabel: "menu"
        }
      ].forEach(function (item) {
        _schemaData[item.schemaLabel] = {};
        grunt.file.expand(srcPath+item.globPattern).forEach(function (filepath) {
          var dir = path.parse(filepath).dir;
          var propertiesSchema = grunt.file.readJSON(filepath);
          var key;
          if (item.bowerAttr) {
            var bower = grunt.file.readJSON(path.join(dir,"bower.json"));
            key = bower[item.bowerAttr];
          } else {
            key = path.parse(filepath).name.split(".")[0];
          }
          
          _schemaData[item.schemaLabel][key] = {};
          _schemaData[item.schemaLabel][key].properties = propertiesSchema.properties || null;
          _schemaData[item.schemaLabel][key].globals = propertiesSchema.globals || null;
        });
      });
    }
    
    function processGlobals () {
      [
        {
          type: "components",
          schemaKey: "components", // key to find in _schemaData
          schemaLabel: "_components" // name used to save in _schemaData.models.course
        },{
          type: "extensions",
          schemaKey: "extensions",
          schemaLabel: "_extensions"
        },{
          type: "menu",
          schemaKey: "menu",
          schemaLabel: "_menu"
        }
      ].forEach(function (item) {
        var data = {};
        var collection = _schemaData[item.schemaKey];
        
        for (var key in collection) {
          var globals = collection[key].globals;
          if (globals !== null) {
            
            var name = key;
            if (item.type === "components") {
              name = "_"+key;
            }
            
            data[name] = {
              type: "object",
              properties: globals
            };
          }
        }
        
        _schemaData.models.course.properties._globals.properties[item.schemaLabel] = {
          type: "object",
          properties: data
        };
      });
    }
    
    function processPluginLocations () {
      [
        {
          type: "components",
          schemaKey: "components"
        },{
          type: "extensions",
          schemaKey: "extensions"
        },{
          type: "menu",
          schemaKey: "menu"
        }
      ].forEach(function (item) {
        var collection = _schemaData[item.schemaKey];
        
        for (var key in collection) {
          var properties = collection[key].properties;
          if (properties.hasOwnProperty("pluginLocations")) {
            var pluginLocations = properties.pluginLocations.properties;
            for (var location in pluginLocations) {
              if (pluginLocations[location].hasOwnProperty("properties")) {
                _copyPropertiesToLocation(location, pluginLocations[location].properties);
                delete _schemaData[item.schemaKey][key].properties.pluginLocations.properties[location];
              }
            }
          }
        }
        
      });
    }
      
    function _copyPropertiesToLocation (location, properties) {
      _schemaData.models[location].properties = _.extend(_schemaData.models[location].properties, properties);
    }
    
    /*
      ****************************************************
      create lookupTables
      traverse propertiesSchema
      ****************************************************
    */
    // function to test if a property should be picked from a schema file
    function _shouldTranslate (obj) {
      // return false if value should be skipped
      // return value that should be picked
      if (obj.hasOwnProperty("translatable")) {
        return obj.translatable;
      } else {
        return false;
      }
    }
    
    // _schemaData traverse function
    function _traverseSchemas (properties, store, path, shouldPickValue) {
    
      var _properties = properties,
          _path = path;
      
      for (var attributeName in _properties) {
        var description = _properties[attributeName];
        
        if (description.hasOwnProperty("editorOnly") || !description.hasOwnProperty("type")) {
          // go to next attribute
          continue;
        }
        
        switch (description.type) {
          case "string":
            // check if attribute should be picked
            var value = shouldPickValue(description);
            if (value !== false) {
              // add value to store
              store[path+attributeName+"/"] = value;
            }
            
            break;
          
          case "object":
            _traverseSchemas(description.properties, store, _path+attributeName+"/", shouldPickValue);
            break;
          
          case "array":
            if (description.items.type === "object") {
              _traverseSchemas(description.items.properties, store, _path+attributeName+"/", shouldPickValue);
            } else {
              var next = {};
              next[attributeName] = description.items;
              _traverseSchemas(next, store, _path, shouldPickValue);
            }
            break;
        }
        
      }
    }
    
    // traverse _schemaData
    function createLookUpTables () {
      _lookupTables.models = {};
      _lookupTables.components = {};
      
      Object.keys(_schemaData.components).forEach(function (component) {
        _lookupTables.components[component] = {};
        var properties = _schemaData.components[component].properties;
        _traverseSchemas(properties, _lookupTables.components[component], "/", _shouldTranslate);
      });

      Object.keys(_schemaData.models).forEach(function (type) {
        _lookupTables.models[type] = {};
        var properties = _schemaData.models[type].properties;
        _traverseSchemas(properties, _lookupTables.models[type], "/", _shouldTranslate);
      });
    }
    
    /*
      ****************************************************
      traverse courseData
      ****************************************************
    */
    
    // checks if _lookupTables has path
    function _lookupHasKey (ltIndex, mt, path) {
      return _lookupTables[ltIndex][mt].hasOwnProperty(path);
    }

    // checks if LookupValue is true
    function _lookupValueIsTrue (ltIndex, mt, path) {
      if (_lookupTables[ltIndex][mt][path] === true) {
        return true;
      } else {
        return false;
      }
    }
        
    // checks lookUpTable if path exists and if set to true
    function _schouldExportText (file, component, path) {
      if (modelTypeMap[file] === "component") {
        
        if (_lookupHasKey("models",modelTypeMap[file],path) || _lookupHasKey("components",component,path)) {
          if (_lookupValueIsTrue("models",modelTypeMap[file], path) || _lookupValueIsTrue("components",component, path)) {
            return true;
          }
        }
        return false;
        
      } else {
        
        if (_lookupHasKey("models",modelTypeMap[file],path)) {
          if (_lookupValueIsTrue("models",modelTypeMap[file], path)) {
            return true;
          }
        }
        return false;
      }
    }
    
    function _traverseCourse(data, level, path, lookupPath, id, file, component, cbs) {

      if (level === 0) {
        // at the root
        id = data.hasOwnProperty("_id") ? data._id : null;
        component = data.hasOwnProperty("_component") ? data._component : null;
      }
      
      
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          _traverseCourse(data[i], level+=1, path+i+"/", lookupPath, id, file, component, cbs);
        }
      
      } else if (typeof data === "object") {
        
        for (var attribute in data) {
          _traverseCourse(data[attribute], level+=1, path+attribute+"/", lookupPath+attribute+"/", id, file, component, cbs);
        }
        
      } else {
        // hanlde value (data)
        for (var j = 0; j < cbs.length; j++) {
          cbs[j].call(this, data, path, lookupPath, file, id, component);
        }
      }
    }
    
    function _collectTexts (data, path, lookupPath, file, id, component) {
      if (_schouldExportText(file, component, lookupPath)) {
        if (data) {
          _exportTextData.push({
            file: file,
            id: id,
            path: path,
            value: data
          });
        }
      }
    }
    
    function processCourseData () {
      
      ["config","course","contentObjects","articles","blocks","components"].forEach(function (file) {
        
        var data = _courseData[file];
        var cbs = [_collectTexts];

        if (Array.isArray(data)) {
          for (var i = 0; i < data.length; i++) {
            _traverseCourse(data[i], 0, "/", "/", null, file, null, cbs);
          }
        } else {
          _traverseCourse(data, 0, "/", "/", null, file, null, cbs);
        }
        
      });

    }
    
    /*
      ****************************************************
      export Files
      ****************************************************
    */
    
    function _exportCSV (filename) {
      var inputs = _exportTextData.reduce(function (prev, current) {
        if (!prev.hasOwnProperty(current.file)) {
          prev[current.file] = [];
        }
      
        prev[current.file].push([current.file+'/'+current.id+current.path, current.value]);
        return prev;
      }, {});
      
      var files = Object.keys(inputs);
      var counter = 0;
      var options = {
        delimiter: csvDel
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
      grunt.file.write(path.join("languagefiles",filename+".json"), JSON.stringify(_exportTextData," ", 4));
      next();
    }
    
    function formatExport () {
      
      var filename = "export_"+lang;
      
      switch (format.toLowerCase()) {
        case "csv":
          _exportCSV(filename);
          break;
        
        default:
          _exportRaw(filename);
          break;
      }
    }
    
  });

};

/*

  _courseData = {
    config: {},
    course: {},
    contentObjects: {},
    articles: {},
    blocks: {},
    components: {},
  }
  
  _schemaData = {
    models: {
      article: {globals: {}, properties: {}}
      block: {globals: {}, properties: {}}
      component: {globals: {}, properties: {}}
      config: {globals: {}, properties: {}}
      contentObjects: {globals: {}, properties: {}}
      course: {globals: {}, properties: {}}
    },
    components: {
      "bower.component": {globals: {}, properties: {}}
    },
    extensions: {
      "bower.targetAttribute": {globals: {}, properties: {}}
    },
    menu: {
      "bower.targetAttribute": {globals: {}, properties: {}}
    }
  }

  _lookupTables = {
    models: {
      article: {
        "/title": true
        "/displayTitle": true,
        "/_trickle/_button/text": true,
        "...": true
      },
      block: {
        "/body": true,
        "/_trickle/_button/text": true,
        "...": true
      },
      component: {
        "/title": true,
        "/displayTitle": true,
        "/body": true,
        "...": true
      },
      config: {
        "...": true
      },
      contentobject: {
        "...": true
      },
      course: {
        "/_globals/_accessibility/_accessibilityToggleTextOn": true,
        "/_globals/_components/_accordion/ariaRegion": true,
        "...": true
      }
    },
    components: {
      accordion: {
        "/instruction": true,
        "/_items/title": true,
        "/_items/body": true,
        "/_items/_graphic/alt": true,
        "...": true
      },
      graphic: {
        "/intruction": true,
        "/_graphic/alt": true,
        "...": true
      },
      textinput: {
        "/_items/_answers"
      }
    }
  }

  _exportTextData = [
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

