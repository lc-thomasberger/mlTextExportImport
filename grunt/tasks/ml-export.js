var util = require("util");
var path = require("path");
var fs = require("fs");
var _ = require("underscore");

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
    
    var srcPath = grunt.config("sourcedir");
    var lang = grunt.option("masterLang") || "en";
    var format = grunt.option("format") || "raw";
    var csvDel = grunt.option("csvDelimiter") || ";";
    var csvEol = "\n";
    var _courseData = {};
    var _schemaData = {};
    var _lookupTables = {};
    var _exportData = [];

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
        }, {
          type: "extensions",
          schemaKey: "extensions",
          schemaLabel: "_extensions"
        }, {
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
      var locations = ["config","course","contentobject","article","block","component"];
      
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
      // use _.extend for this
      _schemaData.models[location].properties = _.extend(_schemaData.models[location].properties, properties);
    }
    
    function _shouldTranslate (obj) {
      // return false if value should be skipped
      // return value that should be picked
      if (obj.hasOwnProperty("translatable")) {
        return obj.translatable;
      } else {
        return false;
      }
    }
    
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
    
    function _shouldExport (file, component, path) {
      // debugger;
      var key = path;
      var modelTypeMap = {
          "config": "config",
          "course": "course",
          "contentObjects": "contentobject",
          "articles": "article",
          "blocks": "block",
          "components": "component"
        };
      
      if (modelTypeMap[file] === "component") {
        
        if (_hasKey("models",modelTypeMap[file],key) || _hasKey("components",component,key)) {
          if (_hasValue("models",modelTypeMap[file], key) || _hasValue("components",component, key)) {
            return true;
          }
        }
        return false;
        
      } else {
        
        if (_hasKey("models",modelTypeMap[file],key)) {
          if (_hasValue("models",modelTypeMap[file], key)) {
            return true;
          }
        }
        return false;
      }
      
      function _hasKey (ltIndex, mt, key) {
        return _lookupTables[ltIndex][mt].hasOwnProperty(key);
      }
      
      function _hasValue (ltIndex, mt, key) {
        return _lookupTables[ltIndex][mt][key];
      }
    }
    
    
    function _traverseCourse(data, store, level, path, lookupPath, id, file, component, shouldExport) {

      if (level === 0) {
        // at the root
        id = data.hasOwnProperty("_id") ? data._id : null;
        component = data.hasOwnProperty("_component") ? data._component : null;
      }
      
      
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          _traverseCourse(data[i], store, level+=1, path+i+"/", lookupPath, id, file, component, shouldExport);
        }
      
      } else if (typeof data === "object") {
        
        for (var attribute in data) {
          _traverseCourse(data[attribute], store, level+=1, path+attribute+"/", lookupPath+attribute+"/", id, file, component, shouldExport);
        }
        
      } else {

        if (shouldExport(file, component, lookupPath)) {
          if (data) {
            store.push({
              file: file,
              id: id,
              path: path,
              value: data
            });
          }
        }
        
      }
    }
    
    function processCourseData () {
      
      ["config","course","contentObjects","articles","blocks","components"].forEach(function (file) {
        
        var data = _courseData[file];

        if (Array.isArray(data)) {
          for (var i = 0; i < data.length; i++) {
            _traverseCourse(data[i], _exportData, 0, "/", "/", null, file, null, _shouldExport);
          }
        } else {
          _traverseCourse(data, _exportData, 0, "/", "/", null, file, null, _shouldExport);
        }
        
      });

    }
    
    function _exportCSV (filename) {
      
      var files = _.groupBy(_exportData, "file");
      
      for (var file in files) {
        var lines = [];
        for (var i = 0; i < files[file].length; i++) {
          lines.push(file+"/"+files[file][i].id+files[file][i].path+csvDel+files[file][i].value);
        }
        grunt.file.write(path.join("languagefiles",file+"_"+filename+".csv"), lines.join(csvEol));
      }
    }
    
    function _exportRaw (filename) {
      grunt.file.write(path.join("languagefiles",filename+".json"), JSON.stringify(_exportData," ", 4));
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

  _exportData = [
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

