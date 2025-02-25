/**
 * @packageDocumentation
 * @see {@link LabelProducer}
 * @author nautofon
 */

import type {
  City,
  Country,
  LabelMeta,
  MileageTarget,
} from '@truckermudgeon/map/types';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import { logger } from '../logger';
import type { MappedDataForKeys } from '../mapped-data';
import { readMapData } from '../mapped-data';
import { createNormalizeFeature } from './normalize';
import { ets2IsoA2 } from './populated-places';

type RegionName = 'usa' | 'europe';

/**
 * A façade to this module. Offers an easy interface to create map labels
 * for whatever combination of game data and meta data you throw at it.
 *
 * @example
 * ```ts
 * const producer = new LabelProducer(
 *   LabelProducer.readMapData('path/to/parser-output', 'usa'),
 *   LabelProducer.readMetas('path/to/meta.json'),
 * );
 * const labels   = producer.makeLabels();
 * const features = labels
 *   .filter( label => label.isValid )
 *   .map( label => label.toGeoJsonFeature() );
 * ```
 *
 * @see {@link Label}
 */
export class LabelProducer {
  /**
   * The game data provider created from the constructor arguments.
   */
  readonly dataProvider: LabelDataProvider;

  private readonly hasMeta: boolean;

  /**
   * @param gameData
   *     The game map data to use as a primary source.
   * @param metas
   *     The metadata records to use for augmenting the labels generated from
   *     mileage targets in the game data. Optional.
   *
   * @see {@link LabelProducer.readMapData}
   * @see {@link readMetas}
   */
  constructor(
    gameData: MappedDataForKeys<['cities', 'countries', 'mileageTargets']>,
    metas?: LabelMeta[],
  ) {
    metas ??= [];
    this.dataProvider = new LabelDataProvider(gameData, metas);
    this.hasMeta = metas.length > 0;
  }

  /**
   * Creates map labels as appropriate for the data provided to the constructor:
   * - a {@link TargetLabel} for every mileage target
   *     (augmented with metadata if provided)
   * - a {@link GenericLabel} for every new label in the metadata (if provided)
   *
   * @returns All map labels for the provided game data and metadata.
   */
  makeLabels(): Label[] {
    const labelClass = {
      usa: AtsLabel,
      europe: Ets2Label,
    }[this.dataProvider.region];
    let labels: Label[] = this.dataProvider.mileageTargets.map(
      target => new labelClass(target, this.dataProvider),
    );

    if (this.hasMeta) {
      labels.forEach(label => this.dataProvider.assignMeta(label));
      labels = labels.concat(this.dataProvider.missingLabels(labels));
    }

    return labels;
  }

  /**
   * Reads game data from the parser output into memory.
   * Suitable for feeding into the {@link LabelProducer} constructor.
   *
   * @param dir    - The path of the dir containing the parser output.
   * @param region - `'europe' | 'usa'`
   *
   * @returns The game map data, restricted to just the properties needed here.
   *
   * @see {@link clis/generator/mapped-data!readMapData}
   */
  static readMapData(
    dir: string,
    region: RegionName,
  ): MappedDataForKeys<['cities', 'countries', 'mileageTargets']> {
    return readMapData(dir, region, {
      mapDataKeys: ['cities', 'countries', 'mileageTargets'],
    });
  }

  /**
   * Reads metadata records from disk into memory.
   *
   * @param jsonPath - The path of the metadata file. Only JSON is implemented.
   *
   * @returns An array of metadata records.
   *
   * @see {@link LabelDataProvider.readMetas}
   */
  static readMetas(jsonPath: string): LabelMeta[] {
    return LabelDataProvider.readMetas(jsonPath);
  }
}

/**
 * Map label.
 */
export interface Label {
  /**
   * True if the map label is considered valid for display.
   *
   * Examples for map labels that aren't valid:
   * - No coordinates are available.
   * - No label text is available (e.g. feature kind is `unnamed`).
   * - No country / state could be determined (may indicate the label is
   *      for a location in a DLC that hasn't been released, or that it's
   *      located in a different game).
   */
  readonly isValid: boolean;

  /**
   * The metadata for the map label.
   *
   * @see https://github.com/nautofon/ats-towns/blob/main/label-metadata.md
   */
  readonly meta: LabelMeta;

  /**
   * @returns The map label as a GeoJSON point feature.
   *
   * @throws Error if no coordinates are available.
   *
   * @see {@link isValid}
   */
  toGeoJsonFeature(): GeoJSON.Feature<GeoJSON.Point, LabelMeta>;
}

/**
 * Map label base class.
 */
export class GenericLabel implements Label {
  protected readonly data: LabelDataProvider;
  readonly meta: LabelMeta;

  /**
   * @param data - The game data provider for the label's region.
   */
  constructor(data: LabelDataProvider) {
    this.data = data;
    this.meta = {};
  }

  get isValid(): boolean {
    return (
      this.meta.kind != 'unnamed' &&
      this.data.hasKnownCountryCode(this.meta) &&
      this.meta.text != null &&
      this.meta.easting != null &&
      this.meta.southing != null
    );
  }

  toGeoJsonFeature(): GeoJSON.Feature<GeoJSON.Point, LabelMeta> {
    const { easting, southing, ...meta } = this.meta;
    const position = [easting, southing];
    if (!position.every(v => v != null)) {
      throw new ReferenceError('toGeoJsonFeature(): coordinates not defined');
    }
    return this.data.normalizeFeature({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: position,
      },
      properties: meta,
    });
  }
}

/**
 * Map label generated from mileage target data.
 *
 * This abstract class contains the heuristics for analyzing mileage targets.
 * It uses the template method pattern in {@link targetAnalysis} to give
 * subclasses an opportunity for adjusting parts of that analysis to match
 * the peculiarities of each game.
 */
export abstract class TargetLabel extends GenericLabel {
  /**
   * The original {@link MileageTarget} that this label was generated from.
   * @internal
   */
  readonly target: MileageTarget;

  /**
   * Details on the mileage target analysis results.
   * @internal
   */
  readonly analysis: TargetAnalysis;

  /**
   * @param target - The {@link MileageTarget} to generate a label for.
   * @param data   - The game data provider for the target's region.
   */
  constructor(target: MileageTarget, data: LabelDataProvider) {
    super(data);
    this.target = target;
    this.analysis = this.targetAnalysis();
  }

  protected targetAnalysis(): TargetAnalysis {
    const analysis = {
      // Placeholder value, to be substituted with something better suited
      // by following the template below.
      tidyName: this.target.defaultName,
    };

    this.determineCountry(analysis);
    this.determineLabelText(analysis); // Label text is needed for city search.
    this.determineCity(analysis);
    this.determineLabelText(analysis); // Refine label text based on found city.
    this.determineExclusionReasons(analysis);
    this.determineAccessDistance(analysis);
    this.applyResults(analysis);
    if (!this.isValid) {
      // If clients choose not to filter out non-valid labels, those should
      // at least be hidden by default.
      this.meta.show = false;
    }
    return analysis;
  }

  protected determineCountry(analysis: TargetAnalysis): void {
    // Mileage target tokens generally begin with a two-letter country code.
    // This step should perhaps involve a spatial analysis, but there are only
    // five known cases where the token-based heuristic fails (all in Croatia).
    // These exceptions might be better handled through metadata.
    const countryMatch = /^([a-z]{2})[a-z_]/i.exec(this.target.token);
    if (countryMatch) {
      analysis.countryCode = countryMatch[1].toUpperCase();
      analysis.country = this.data.countryFromCode(analysis.countryCode);
    }
  }

  protected determineCity(analysis: TargetAnalysis): void {
    // Mileage targets referring to a city can often be identified by
    // searching for a city of the same name. But mileage target names
    // tend to use varying spellings, so we need to check them all.
    analysis.city = [
      this.target.defaultName,
      ...this.target.nameVariants,
      analysis.tidyName,
    ]
      .map(name => this.data.cityFromName(name, analysis.country))
      .find(city => !!city);

    analysis.cityToken = analysis.city?.token;
  }

  protected determineLabelText(analysis: TargetAnalysis): void {
    // The mileage target default name is the most reliable source overall.
    // But for cities, the name from the city dataset is actually better.
    let tidyName = (analysis.city?.name ?? this.target.defaultName)
      // Drop all html-like tags. Only use first line of multi-line names.
      .replace(/<br>.*/i, '')
      .replace(/<.*?>/g, '');

    // All upper case or all lower case: change to title case.
    if (
      /^\P{Lowercase_Letter}+$/u.test(tidyName) ||
      /^\P{Uppercase_Letter}+$/u.test(tidyName)
    ) {
      // JavaScript regexes don't have Unicode-aware boundary assertions;
      // (?<=^|\P{Letter}) works more or less like \b, but for Unicode text.
      tidyName = tidyName.replace(
        /(?<=^|\P{Letter})(\p{Letter})(\p{Letter}*)/gu,
        (_, first, remaining) =>
          (first as string).toUpperCase() + (remaining as string).toLowerCase(),
      );
    }
    analysis.tidyName = tidyName;
  }

  protected determineExclusionReasons(analysis: TargetAnalysis): void {
    // Some mileage targets just refer to unnamed highway junctions.
    analysis.excludeJunction = this.target.editorName.includes(' x ');
  }

  protected determineAccessDistance(analysis: TargetAnalysis): void {
    // A limit of 20 is high, but at least avoids some pathological cases.
    analysis.tooMuchDistance = this.target.distanceOffset > 20;
  }

  protected applyResults(analysis: TargetAnalysis): void {
    this.meta.token = this.target.token;
    this.meta.text = analysis.tidyName;
    this.meta.easting = this.target.x;
    this.meta.southing = this.target.y;

    if (analysis.country) {
      this.meta.country = analysis.countryCode;
    }
    if (analysis.city) {
      this.meta.kind = 'city';
      this.meta.city = analysis.city.token;
      this.meta.show = false;
    }
    if (
      analysis.excludeBorder ||
      analysis.excludeJunction ||
      analysis.excludeNumber
    ) {
      this.meta.kind = 'unnamed';
      this.meta.text = this.target.editorName;
    }
    if (analysis.tooMuchDistance) {
      this.meta.access = false;
      this.meta.show = false;
    }
  }
}

/**
 * Map label generated from American Truck Simulator mileage targets.
 *
 * Contains heuristics for ATS `editorName` practice, common American
 * abbreviations for names on road signs, exclusion of "unnamed" state line
 * and road number targets, distance offset limit, and the ISO state code.
 */
export class AtsLabel extends TargetLabel {
  protected override determineCity(analysis: TargetAnalysis): void {
    super.determineCity(analysis);

    // In ATS, the mileage target editor name of cities is usually exactly
    // the city name with the state abbreviation in front of it.
    const cityByEditorName = this.data.cityFromName(
      this.target.editorName.replace(
        new RegExp(`^${analysis.countryCode} `),
        '',
      ),
      analysis.country,
    );

    if (cityByEditorName) {
      analysis.city = cityByEditorName;
      analysis.cityTokenEditorName = cityByEditorName.token;
    }
  }

  protected override determineLabelText(analysis: TargetAnalysis): void {
    super.determineLabelText(analysis);

    // If signs in the game world abbreviate a name, but the name can reasonably
    // be spelled out in full, the `text` should also be spelled out in full.
    analysis.tidyName = analysis.tidyName
      .replace(/ Ck$/, ' Creek')
      .replace(/^Ft\.? /, 'Fort ')
      .replace(/ Jct$/, ' Junction')
      .replace(/ Mtn$/, ' Mountain')
      .replace(/^St\.? /, 'Saint ')
      .replace(/^So /, 'South ')
      .replace(/ Spgs$| Sprs\.$/, ' Springs');
  }

  protected override determineExclusionReasons(analysis: TargetAnalysis): void {
    super.determineExclusionReasons(analysis);

    // In ATS, some mileage targets just refer to the border between states.
    const re = new RegExp(`^(?:${analysis.countryCode} )?State Line$`);
    analysis.excludeBorder = this.target.nameVariants.reduce(
      (prev, name) => prev || re.test(name),
      /\bState Line$/.test(this.target.defaultName),
    );

    // In ATS, some mileage targets just refer to other highways.
    // This rule also catches regular names that happen to include route
    // numbers. Many such cases should be excluded, but there are exceptions,
    // e.g. Ritzville, WA. These must be fixed manually through metadata.
    analysis.excludeNumber = new RegExp(
      `\\b(?:US|I|Hwy|${analysis.countryCode})[- ]?[1-9][0-9]*[ENSW]?\\b`,
    ).test(this.target.editorName);
  }

  protected override determineAccessDistance(analysis: TargetAnalysis): void {
    // A large distance offset means that the target is far away from the town
    // it's referring to, often so far away that the town doesn't exist in the
    // game world at all. In ATS, experience suggests that this is the case
    // for all offsets > 7 and _not_ the case for most offsets < 5.
    analysis.tooMuchDistance = this.target.distanceOffset > 6;
  }

  protected override applyResults(analysis: TargetAnalysis): void {
    super.applyResults(analysis);

    if (analysis.country) {
      // The United States are currently the only country in ATS.
      // The "country code" actually identifies the state.
      this.meta.country = 'US-' + analysis.country.code;
    }
  }
}

/**
 * Map label generated from Euro Truck Simulator 2 mileage targets.
 *
 * Contains heuristics for ETS2 `editorName` practice, exclusion of "unnamed"
 * country border targets, and the ISO country code.
 */
export class Ets2Label extends TargetLabel {
  protected override determineCity(analysis: TargetAnalysis): void {
    super.determineCity(analysis);

    // In ETS2, the mileage target editor name of cities is usually exactly
    // the city token.
    const cityByEditorName = this.data.cityFromToken(
      this.target.editorName,
      analysis.country,
    );

    if (cityByEditorName) {
      analysis.city = cityByEditorName;
      analysis.cityTokenEditorName = cityByEditorName.token;
    }
  }

  protected override determineExclusionReasons(analysis: TargetAnalysis): void {
    super.determineExclusionReasons(analysis);

    // In ETS2, some mileage targets just refer to the border between countries.
    analysis.excludeBorder = /^[a-z]{2}_bord(?:er)?_/.test(this.target.token);
  }

  protected override applyResults(analysis: TargetAnalysis): void {
    super.applyResults(analysis);

    // Mileage target tokens use UK, but the ISO code is GB.
    if (this.meta.country == 'UK') {
      this.meta.country = 'GB';
    }
  }
}

/**
 * Details on the mileage target analysis results.
 * @internal
 */
export interface TargetAnalysis {
  /**
   * Mileage target name, tidied for use as map label text.
   */
  tidyName: string;

  /**
   * The two-letter code used by SCS to identify a state or country in the
   * mileage target's unit token. Not necessarily an ISO 3166 code.
   */
  countryCode?: string;

  /**
   * The {@link Country} object for the country or state this mileage target is
   * located in. Because Country objects are only available for the "base map"
   * and released DLC, this property can be used as a proxy to determine
   * whether the mileage target location is actually accessible by players.
   * However, unreleased changes to already released DLC (such as "Texas 2.0")
   * aren't detectable this way.
   */
  country?: Country;

  /**
   * The {@link City} object for the city this mileage target represents.
   * As long as the map uses a separate data source for city labels, mileage
   * targets referring to cities need to be identified here. Doing so allows
   * filtering them to prevent duplicate names from being shown on the map.
   */
  city?: City;

  /**
   * The SCS token for {@link city}, _except_ if the city was identified using
   * the mileage target's `editorName`.
   */
  cityToken?: string;

  /**
   * The SCS token for {@link city} if the city _was_ identified using
   * the mileage target's `editorName`.
   */
  cityTokenEditorName?: string;

  /**
   * True if the mileage target seems to be for an unnamed state line
   * or country border crossing.
   */
  excludeBorder?: boolean;

  /**
   * True if the mileage target seems to be for an unnamed junction.
   */
  excludeJunction?: boolean;

  /**
   * True if the mileage target seems to include a highway route number,
   * which often indicates an unnamed location.
   */
  excludeNumber?: boolean;

  /**
   * True if the mileage target has a distance offset so large that the
   * feature identified by it almost certainly is not in the game at all.
   */
  tooMuchDistance?: boolean;
}

/**
 * This class gives access to parser results and to the metadata table.
 * It offers utility methods for easily querying particular aspects
 * needed for mileage target analysis.
 *
 * Metadata records with `country` attributes that don't match the
 * game region of the loaded parser results are ignored. As a result,
 * - one metadata file can apply to multiple regions, and
 * - multiple metadata files can apply to a single region.
 */
export class LabelDataProvider {
  // This class is somewhat inefficient, with nested sequential searches.
  // But we have at most a few thousand entries, so it doesn't really matter.

  /**
   * The full list of {@link MileageTarget} objects read from the parser output.
   */
  readonly mileageTargets: readonly MileageTarget[];

  /**
   * Function to transform game coordinates to geographic coordinates.
   *
   * @param feature - A GeoJSON.Feature with (projected) game coordinates.
   *
   * @returns The modified feature, now with coordinates conforming to GeoJSON.
   *
   * @see {@link clis/generator/geo-json/normalize!createNormalizeFeature}
   */
  readonly normalizeFeature: <
    T extends GeoJSON.Feature<GeoJSON.Point, LabelMeta>,
  >(
    feature: T,
  ) => T;

  protected readonly gameData: MappedDataForKeys<
    ['cities', 'countries', 'mileageTargets']
  >;
  protected readonly metas: LabelMeta[];
  protected readonly metaByToken: Map<string, LabelMeta>;

  /**
   * @param gameData
   *     The game map data to use as a primary source.
   * @param metas
   *     The metadata records to use for augmenting the labels generated from
   *     mileage targets in the game data.
   *
   * @see {@link clis/generator/mapped-data!readMapData}
   * @see {@link readMetas}
   */
  constructor(
    gameData: MappedDataForKeys<['cities', 'countries', 'mileageTargets']>,
    metas: LabelMeta[],
  ) {
    this.gameData = gameData;

    // Metadata records with no country attribute might still be assignable via
    // the token, thus we don't filter on an `undefined` region check result.
    this.metas = metas.filter(meta => this.isInRegion(meta) !== false);

    this.metaByToken = new Map(this.metas.map(x => [x.token ?? '', x]));
    this.metaByToken.delete('');

    this.mileageTargets = Array.from(this.gameData.mileageTargets.values());

    // Four decimal places = meter-level precision in the scaled game world.
    const precision = 4;
    this.normalizeFeature = createNormalizeFeature(this.region, precision);
  }

  /**
   * Search the metadata table for a record that's applicable to the given
   * label, using the `token` attribute for matching. Assign any found
   * metadata to the given map label.
   *
   * Attributes missing in the metadata table will be ignored; for all other
   * attributes, the value from the metadata table (even the value `null`)
   * will replace any previous value in the label.
   *
   * @param label - The map label to assign metadata to.
   *
   * @see {@link LabelMeta}
   */
  assignMeta(label: Label): void {
    const meta = this.metaByToken.get(label.meta.token ?? '');
    if (meta) {
      Object.assign(label.meta, meta);
    }
  }

  /**
   * Compare the metadata table with the given list of existing map labels,
   * using the `token` attribute for matching. Return new map label instances
   * for any metadata records that have no matching existing label.
   *
   * @param existing - The label list to check (usually from mileage targets).
   *
   * @returns A list of new {@link GenericLabel} instances, created from the
   *     metadata table.
   */
  missingLabels(existing: Label[]): Label[] {
    const existingByToken = new Map(
      existing.map(label => [label.meta.token, label]),
    );
    const missingMeta = this.metas.filter(
      meta => !existingByToken.has(meta.token),
    );
    return missingMeta.map(meta => {
      const label = new GenericLabel(this);
      Object.assign(label.meta, meta);
      if (meta.token && this.isInRegion(meta)) {
        logger.warn(
          `Can't assign metadata for target ${meta.token} unknown in ${this.region}${label.isValid ? ' (label valid)' : ''}`,
        );
      }
      return label;
    });
  }

  /**
   * Search for a city in a particular country's game data by city name.
   *
   * Note that this check would be most effective with raw, non-localized city
   * names, but {@link clis/parser/game-files/map-files-parser!parseMapFiles}
   * currently only provides names localized into English.
   *
   * @param name    - The city name to look up.
   * @param country - The mileage target country to restrict the search to.
   *
   * @returns The {@link City} object. `undefined` if none was found or no
   *     `country` was given.
   */
  cityFromName(name: string, country: Country | undefined): City | undefined {
    return Array.from(this.gameData.cities.values()).find(
      city =>
        country?.token == city.countryToken &&
        city.name.localeCompare(name, undefined, {
          usage: 'search',
          sensitivity: 'accent',
        }) == 0,
    );
  }

  /**
   * Search for a city in a particular country's game data by city token.
   *
   * @param token   - The city token to look up.
   * @param country - The mileage target country to restrict the search to.
   *
   * @returns The {@link City} object. `undefined` if none was found or no
   *     `country` was given.
   */
  cityFromToken(token: string, country: Country | undefined): City | undefined {
    const city = this.gameData.cities.get(token);

    // Verify the country as a sanity check.
    return country?.token == city?.countryToken ? city : undefined;
  }

  /**
   * Search for a country in the game data by mileage target token country code.
   *
   * Country codes in mileage target tokens mostly follow ISO 3166
   * (but UK is used for Great Britain and XK for Kosovo).
   * In the game's country data, codes used for ATS are ISO subdivisions, while
   * ETS2 uses the Distinguishing Sign of Vehicles in International Traffic.
   *
   * @param code - The mileage target country code to look up.
   *
   * @returns The {@link Country} object, or `undefined` if none was found.
   *
   * @see {@link clis/generator/geo-json/populated-places!ets2IsoA2}
   */
  countryFromCode(code: string): Country | undefined {
    return Array.from(this.gameData.countries.values()).find(
      country =>
        ets2IsoA2.get(country.code) == code ||
        country.code == code ||
        // The ISO and DSIT codes are GB, but mileage target tokens use UK.
        (country.code == 'GB' && code == 'UK'),
    );
  }

  /**
   * Check whether a metadata record has an ISO 3166-1 or ISO 3166-2 code
   * that matches a country in the provided game data.
   *
   * @param meta - The metadata record for which to look up the country /
   *               country and subdivision ISO code.
   *
   * @returns True if the given code identifies a country in the game data.
   *
   * @see {@link clis/generator/geo-json/populated-places!ets2IsoA2}
   */
  hasKnownCountryCode(meta: LabelMeta): boolean {
    return !!(
      meta.country != null &&
      this.isInRegion(meta) &&
      this.countryFromCode(meta.country.replace(/^(?:CA|MX|US)-/, ''))
    );
  }

  /**
   * Check whether a metadata record is applicable to the same region as the
   * provided game data is for.
   *
   * @param meta - The metadata record to check.
   *
   * @returns
   * - `true` if the metadata record's country is in this game region.
   * - `false` if the metadata record's country is in another game region.
   * - `undefined` if the metadata record doesn't identify a country.
   */
  isInRegion(meta: LabelMeta): boolean | undefined {
    if (!meta.country) {
      return undefined;
    }
    return /^(?:CA|MX|US)/.test(meta.country) == (this.region == 'usa');
  }

  /**
   * The name of the region for which game data is provided
   * (`'europe'` or `'usa'`).
   */
  get region(): RegionName {
    return this.gameData.map;
  }

  /**
   * Reads metadata records from disk into memory.
   *
   * @param jsonPath - The path of the metadata file. Only JSON is implemented.
   *
   * @returns An array of metadata records.
   */
  static readMetas(jsonPath: string): LabelMeta[] {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as LabelMeta[];
  }
}
