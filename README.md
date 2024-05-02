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
git clone git@github.com:truckermudgeon/maps.git .

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

# generate combined ATS and ETS2 cities.geojson file
npx generator cities -m usa -m europe -i dirWithParserOutput -o dirToWriteFilesTo

# generate combined ATS and ETS2 footprints.geojson file
npx generator footprints -m usa -m europe -i dirWithParserOutput -o dirToWriteFilesTo

# generate spritesheet files
npx generator spritesheet -i dirWithParserOutput -o dirToWriteFilesTo
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
# Then run the following to start the web server:
npm start --workspace=packages/apps/demo
```

### prefabs-app

`prefabs-app` is a React app that helps visualize and debug how PrefabDescriptions are converted into LineStrings and Polygons.

![prefabs-screenshot](https://raw.githubusercontent.com/truckermudgeon/maps/main/packages/apps/prefabs/screenshot.png)

```shell
# from the project root:
#
# 1. run the `parser` command listed above to generate
#      usa-prefabDescriptions.json
#
# 2. copy usa-prefabDescriptions.json to
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
- [CityHash](https://github.com/google/cityhash)

The `generator` project makes use of data from [Natural Earth](https://www.naturalearthdata.com/).
