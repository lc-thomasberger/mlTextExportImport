# Multi Language Text Export / Import

## Export
`grunt ml-export --format="csv"`

## translate Course
Translate Language Files stored in /languagefiles/*.csv

## Import and create a german copy of the english course
`grunt ml-import --targetLang="de" --files="articles_export_de.csv,blocks_export_de.csv,components_export_de.csv,contentObjects_export_de.csv,course_export_de.csv"`