# TruckSim Maps

TruckSim Maps is a collection of tools and components for building web-based maps for
[American Truck Simulator](https://americantrucksimulator.com/) and
[Euro Truck Simulator 2](https://eurotrucksimulator2.com/).

The long-term goal of the project is to build a Route Advisor for ATS that can run on a
phone or tablet.

A demo app built with these tools and components can be found at https://truckermudgeon.github.io/.

## Getting Started

### Prerequisites

- [Node and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [node-gyp](https://github.com/nodejs/node-gyp)

### Installation

```shell
# clone the repo into a local directory
mdkir maps
cd maps
git clone --recurse-submodules https://github.com/truckermudgeon/maps.git .

# install maps projects
npm install

# build native addon
npm run build -w packages/clis/parser
```

## Projects

The TruckSim Maps repo contains the following projects:

### parser

`parser` is a CLI tool that parses map data in ATS/ETS2 files and outputs JSON and
PNG files.

```shell
npx parser -i pathToGameDirectory -o dirToWriteFilesTo
```

Parsing can take a couple of minutes, depending on the machine and the installed map DLCs.

> [!NOTE]
>
> - All released map DLCs are supported.
> - Third-party map mods are not supported.

### generator

`generator` is a CLI tool that generates GeoJSON, PMTiles and [MapLibre](https://maplibre.org/)
[spritesheet files](https://maplibre.org/maplibre-style-spec/sprite/) from `parser` output.

```shell
# generate ATS pmtiles file
npx generator map -m usa -i dirWithParserOutput -o dirToWriteFilesTo

# generate ETS2 pmtiles file
npx generator map -m europe -i dirWithParserOutput -o dirToWriteFilesTo

# generate ATS and ETS2 footprints pmtiles files
npx generator footprints -m usa -m europe -i dirWithParserOutput -o dirToWriteFilesTo

# generate spritesheet files
npx generator spritesheet -m usa -m europe -i dirWithParserOutput -o dirToWriteFilesTo

# generate geojson files with map labels for scenery towns and villages
packages/clis/generator/resources/extra-labels/script/csv2json.pl \
  packages/clis/generator/resources/extra-labels/US/*.csv \
  -o packages/clis/generator/resources/usa-labels-meta.json
npx generator extra-labels -m usa -i dirWithParserOutput -o dirToWriteFilesTo
npx generator ets2-villages -o dirToWriteFileTo

# generate ATS and ETS2 geojson files used for POI searches
npx generator search -m usa -i dirWithParserOutput -o dirToWriteFileTo -x pathToExtraLabelsGeoJSON
npx generator search -m europe -i dirWithParserOutput -o dirToWriteFileTo

# generate ATS and ETS2 contours (aka elevations) pmtiles files
npx generator contours -m usa -m europe -i dirWithParserOutput -o dirToWriteFilesTo

# generate ATS achievements.geojson file
npx generator achievements -m usa -i dirWithParserOutput -o dirToWriteFileTo
```

> [!IMPORTANT]
> PMTiles output requires [tippecanoe](https://github.com/felt/tippecanoe) to be installed.

The generated GeoJSON for roads and prefabs is far from perfect; many
intersections look incorrect. Improvements to how they're generated
are slowly being made.

### demo-app

`demo-app` is a React app that renders ATS/ETS2 maps.

![demo-screenshot](https://raw.githubusercontent.com/truckermudgeon/maps/main/packages/apps/demo/screenshot.png)

```shell
# from the project root:
# run the `generator` commands listed above, specifying
#
#   packages/apps/demo/public
#
# as the output directory.
#
# Then run the following to generate the world map base layer:
#
#   tippecanoe -Z4 -z8 -b 10 -X -o packages/apps/demo/public/world.pmtiles \
#       clis/generator/resources/countries.geojson \
#       clis/generator/resources/states.geojson \
#       clis/generator/resources/water.geojson
#
# Then run the following to start the web server:
npm start --workspace=packages/apps/demo
```

The achievements search feature additionally requires the `achievements.json`
file for each game (as described in [AchievementSearchBar.tsx](packages/apps/demo/src/AchievementSearchBar.tsx)).
You can download these files from [truckermudgeon.github.io](https://github.com/truckermudgeon/truckermudgeon.github.io).

### prefabs-app

`prefabs-app` is a React app that helps visualize and debug how PrefabDescriptions are converted into LineStrings and Polygons.

![prefabs-screenshot](https://raw.githubusercontent.com/truckermudgeon/maps/main/packages/apps/prefabs/screenshot.png)

```shell
# from the project root:
#
# 1. run the `parser` command listed above to generate
#      usa-prefabDescriptions.json
#      usa-prefabs.json
#      usa-nodes.json
#
# 2. copy those generated files to
#      packages/apps/prefabs/public
#
# Then run the following to start the web server:
npm start --workspace=packages/apps/prefabs
```

## License

TruckSim Maps is licensed under GPL v3.

## Credits

Parts of the `parser` and `generator` projects are based on:

- [TsMap](https://github.com/dariowouters/ts-map/)
- [TruckLib](https://github.com/sk-zk/TruckLib/)
- [SCS Blender Tools](https://github.com/SCSSoftware/BlenderTools)
- [ConverterPIX](https://github.com/mwl4/ConverterPIX/)

The `parser` project includes code from:

- [CityHash](https://github.com/google/cityhash)
- Nvidia's [libdeflate fork](https://github.com/NVIDIA/libdeflate)

The `generator` project includes data from [Natural Earth](https://www.naturalearthdata.com/).
