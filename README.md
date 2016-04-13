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
- [ ] add support for "_languages": ["de","en","fr"] in components.json
  add this to the master course. When export to a target language only components for this language will be used
- [ ] check if course exists and add modes or force flag:
  - safe: break if course already exists
  - replace: only replace text and [assets]
  - copy: creae a new copy of the master course and replace text and assets
- [ ] use npm module to generate csv-files?
- [ ] test [grunt-xliff module](https://www.npmjs.com/package/grunt-xliff)
- [ ] add support for assets (images, audios)
  - pattern
    - add pattern (images/image-1-[:lang:].jpg) eg. images/image-1-en.jpg, images/image-1-de.jpg
    - check if image for language is in assets folder of master course
    - copy to target course and relink or use master course version
  - assets File
    - like a languageFile just for assets
    - mapping of key to name of asset
- [ ] create a new standalone single language course from a languagefile
  - copy master course and replace course/[lang] folder
