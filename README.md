# Multi Language Text Export / Import

## Tasks
`grunt ml-export`

`--format="[csv|raw]"`
Format of exported Language Files

`--csvDelimiter=";"`
Delimiter used to create CSV Tables

`grunt ml-import`

`--files"file1.csv,file2.csv"`
Language Files seperated by a comma

`--masterLang="en"`
Course that's copied to create the new Version

`--targetLang="de"`
Language of the new Course

`--csvDelimiter=";"`
Delimiter used to read CSV Tables

### Export
`grunt ml-export --format="csv"`

### translate Course
Translate Language Files stored in `/languagefiles/*.csv`

### Import and create a german copy of the english course
`grunt ml-import --targetLang="de" --files="articles_export_de.csv,blocks_export_de.csv,components_export_de.csv,contentObjects_export_de.csv,course_export_de.csv"`

### View the "german" Course
`grunt server`
You should now see a course with content prefixed with "de:"


#### todos:
- add support for "_languages": ["de","en","fr"] in components.json
  add this to the master course. when export to a target language only compoents for this language will be used
- use external module to generate csv-files?
- test [grunt-xliff module](https://www.npmjs.com/package/grunt-xliff)
