PARSER_OUT_DIR := out/parser
GENERATOR_OUT_DIR := out
DEMO_APP_OUT_DIR := ../truckermudgeon.github.io

ATS_DIR := "~/Library/Application Support/Steam/steamapps/common/American Truck Simulator"
ETS2_DIR := "~/Library/Application Support/Steam/steamapps/common/Euro Truck Simulator 2"

##### `parser`-generated files ###############################################

# note: values come from properties of `DefData`...
PARSER_JSON_NAMES = countries companyDefs roadLooks prefabDescriptions modelDescriptions achievements routes
# ...and `MapData` types.
PARSER_JSON_NAMES += nodes elevation roads ferries prefabs companies models mapAreas pois dividers trajectories \
		triggers cutscenes cities

ATS_PARSER_JSON_FILES := $(patsubst %,$(PARSER_OUT_DIR)/usa-%.json,$(PARSER_JSON_NAMES))
ETS2_PARSER_JSON_FILES := $(patsubst %,$(PARSER_OUT_DIR)/europe-%.json,$(PARSER_JSON_NAMES))

$(ATS_PARSER_JSON_FILES):
	npx parser -i $(ATS_DIR) -o $(PARSER_OUT_DIR)

$(ETS2_PARSER_JSON_FILES):
	npx parser -i $(ETS2_DIR) -o $(PARSER_OUT_DIR)

##### `generator`-generated files ############################################

RESOURCES_DIR := packages/clis/generator/resources
MAP_FILES :=

#### pmtiles files

# Create base-layer world.pmtiles
$(GENERATOR_OUT_DIR)/world.pmtiles: $(addprefix $(RESOURCES_DIR)/,water.geojson countries.geojson states.geojson)
	tippecanoe -Z4 -z8 -b 10 -X -o $@ $^

MAP_FILES += $(GENERATOR_OUT_DIR)/world.pmtiles


# Create ATS and ETS2 pmtiles files
$(GENERATOR_OUT_DIR)/ats.pmtiles: $(ATS_PARSER_JSON_FILES)
	npx generator map -h -m usa -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)
$(GENERATOR_OUT_DIR)/ets2.pmtiles: $(ETS2_PARSER_JSON_FILES)
	npx generator map -h -m europe -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/ats.pmtiles
MAP_FILES += $(GENERATOR_OUT_DIR)/ets2.pmtiles


# Create ATS and ETS2 footprints pmtiles files
$(GENERATOR_OUT_DIR)/ats-footprints.pmtiles: $(ATS_PARSER_JSON_FILES)
	npx generator footprints -m usa -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)
$(GENERATOR_OUT_DIR)/ets2-footprints.pmtiles: $(ETS2_PARSER_JSON_FILES)
	npx generator footprints -m europe -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/ats-footprints.pmtiles
MAP_FILES += $(GENERATOR_OUT_DIR)/ets2-footprints.pmtiles


# Create ATS and ETS2 contours (aka elevations) pmtiles files
$(GENERATOR_OUT_DIR)/ats-contours.pmtiles: $(ATS_PARSER_JSON_FILES)
	npx generator contours -m usa -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)
$(GENERATOR_OUT_DIR)/ets2-contours.pmtiles: $(ETS2_PARSER_JSON_FILES)
	npx generator contours -m europe -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/ats-contours.pmtiles
MAP_FILES += $(GENERATOR_OUT_DIR)/ets2-contours.pmtiles


#### geojson files

# Create ATS and ETS2 achievements.geojson files
$(GENERATOR_OUT_DIR)/ats-achievements.geojson: $(ATS_PARSER_JSON_FILES)
	npx generator achievements -m usa -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)
$(GENERATOR_OUT_DIR)/ets2-achievements.geojson: $(ETS2_PARSER_JSON_FILES)
	npx generator achievements -m europe -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/ats-achievements.geojson
MAP_FILES += $(GENERATOR_OUT_DIR)/ets2-achievements.geojson


# Create ATS extra-labels.geojson file
$(RESOURCES_DIR)/usa-labels-meta.json: \
		$(RESOURCES_DIR)/extra-labels/script/csv2json.pl \
		$(RESOURCES_DIR)/extra-labels/US \
		$(RESOURCES_DIR)/extra-labels/US/*.csv
	$(RESOURCES_DIR)/extra-labels/script/csv2json.pl \
		$(RESOURCES_DIR)/extra-labels/US/*.csv \
		-o $(RESOURCES_DIR)/usa-labels-meta.json
$(GENERATOR_OUT_DIR)/extra-labels.geojson: $(ATS_PARSER_JSON_FILES) $(RESOURCES_DIR)/usa-labels-meta.json
	npx generator extra-labels -m usa -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/extra-labels.geojson


# Create ETS2 villages.geojson file
$(GENERATOR_OUT_DIR)/ets2-villages.geojson: $(RESOURCES_DIR)/villages-in-ets2.csv
	npx generator ets2-villages -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/ets2-villages.geojson


# Create ATS and ETS2 search.geojson files
$(GENERATOR_OUT_DIR)/ats-search.geojson: $(ATS_PARSER_JSON_FILES) $(GENERATOR_OUT_DIR)/extra-labels.geojson
	npx generator search -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR) -x $(GENERATOR_OUT_DIR)/extra-labels.geojson
$(GENERATOR_OUT_DIR)/ets2-search.geojson: $(ETS2_PARSER_JSON_FILES) $(RESOURCES_DIR)/villages-in-ets2.csv
	npx generator search -m europe -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(GENERATOR_OUT_DIR)/ats-search.geojson
MAP_FILES += $(GENERATOR_OUT_DIR)/ets2-search.geojson


#### other map resources

# Copy ATS and ETS2 achievements.json
$(GENERATOR_OUT_DIR)/ats-achievements.json: $(RESOURCES_DIR)/ats-achievements.json
	@cp $^ $@
$(GENERATOR_OUT_DIR)/ets2-achievements.json: $(RESOURCES_DIR)/ets2-achievements.json
	@cp $^ $@

MAP_FILES += $(GENERATOR_OUT_DIR)/ats-achievements.json
MAP_FILES += $(GENERATOR_OUT_DIR)/ets2-achievements.json


# Create ATS graph demo json
$(GENERATOR_OUT_DIR)/usa-graph-demo.json: $(ATS_PARSER_JSON_FILES)
	npx generator graph -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR) -c -d

MAP_FILES += $(GENERATOR_OUT_DIR)/usa-graph-demo.json


# Create spritesheet files
SPRITESHEET_FILES := $(addprefix $(GENERATOR_OUT_DIR)/,sprites.png sprites.json sprites@2x.png sprites@2x.json)
$(SPRITESHEET_FILES): $(ATS_PARSER_JSON_FILES) $(ETS2_PARSER_JSON_FILES)
	npx generator spritesheet -m usa -m europe -i $(PARSER_OUT_DIR) -o $(GENERATOR_OUT_DIR)

MAP_FILES += $(SPRITESHEET_FILES)


demo-data: $(MAP_FILES) ## builds map data for demo-app

##############################################################################

DEMO_PACKAGE_DIR := packages/apps/demo

demo-app: ## builds web assets for demo-app
	npm run build -w $(DEMO_PACKAGE_DIR)

##############################################################################

demo: demo-data demo-app ## builds map data and web assets for demo-app and copies them to demo-app directory
	@rm -rf $(DEMO_APP_OUT_DIR)/assets
	@cp -R $(DEMO_PACKAGE_DIR)/build/assets $(DEMO_APP_OUT_DIR)
	@cp $(DEMO_PACKAGE_DIR)/build/index.html $(DEMO_APP_OUT_DIR)
	@cp $(MAP_FILES) $(DEMO_APP_OUT_DIR)
	@$(foreach src,\
		$(shell git ls-files $(DEMO_PACKAGE_DIR)/public),\
		cp $(src) $(subst $(DEMO_PACKAGE_DIR)/public,$(DEMO_APP_OUT_DIR),$(src));)


clean: ## deletes all parser and generator outputs
	@rm -f $(ATS_PARSER_JSON_FILES) $(ETS2_PARSER_JSON_FILES)
	@rm -rf $(PARSER_OUT_DIR)/icons
	@rm -f $(MAP_FILES)
	@rm -f $(RESOURCES_DIR)/usa-labels-meta.json

# generated `help` target
# https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.PHONY: demo demo-data demo-app clean help

.DEFAULT_GOAL := help
