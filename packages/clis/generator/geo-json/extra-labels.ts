/**
 * @packageDocumentation
 * @see {@link LabelProducer}
 * @author nautofon
 */

import type { City, Country, MileageTarget } from '@truckermudgeon/map/types';
import type { GeoJSON } from 'geojson';
import type { MappedDataForKeys } from '../mapped-data';

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
 *   .filter( label => label.isValid() )
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
  }
}

/**
 * Metadata attributes for a map label.
 *
 * All attributes are optional. When applying metadata to labels generated
 * from mileage targets, an __undefined__ attribute (`null`) should cause
 * that attribute to be undefined in the result as well, whereas a
 * __missing__ attribute should cause the result to use the mileage target
 * data for that particular attribute.
 *
 * @see https://github.com/nautofon/ats-towns/blob/main/label-metadata.md
 */
export interface LabelMeta {
  // Meant for JSON, thus this interface must use null rather than undefined.

  /**
   * The token identifying the mileage target to apply the label attributes to.
   *
   * If missing or undefined, this object describes a new label instead.
   */
  token?: string | null;

  /**
   * The label text / feature name.
   */
  text?: string | null;

  /**
   * The adjusted easting, if any.
   *
   * Label metadata attributes use the terms easting and {@link southing} to
   * refer to `x` / `y` coordinates. These more verbose terms avoid ambiguity
   * of the coordinates' axis order and orientation. In the software project
   * "Web-based maps for ATS and ETS2", only this interface {@link LabelMeta}
   * and its implementers use these terms, in order to match the data files.
   *
   * The attributes easting and southing may be missing in metadata if the
   * position read from mileage target data is already adequate.
   */
  easting?: number | null;

  /**
   * The adjusted southing, if any.
   *
   * @see {@link easting}
   */
  southing?: number | null;

  /**
   * The kind of location this label is for.
   *
   * Possible values include `city`, `town`, `unnamed`, and several others.
   * Missing for most labels generated from new unassessed mileage targets;
   * for such labels, the best value to assume as default is probably `town`.
   *
   * Label objects of the kind `unnamed` are not suitable for map display.
   */
  kind?: string | null;

  /**
   * Describes how the name is signed at a location in the game.
   *
   * Possible values are:
   * - `all`:    Name well visible, no matter which direction you arrive from.
   * - `most`:   Name visible when arriving from a clear majority of directions.
   * - `some`:   Name visible in _some_ way, but it may not be very obvious.
   * - `remote`: Name _not_ visible on site, but it appears on distance or
   *             direction signs elsewhere.
   */
  signed?: 'all' | 'most' | 'some' | 'remote' | null;

  /**
   * True if a core part of the named location is accessible during regular
   * gameplay.
   */
  access?: boolean | null;

  /**
   * True if the label is for a game location with deliverable industry, for
   * example a scenery town with company depots (sometimes called a "suburb").
   */
  industry?: boolean | null;

  /**
   * The SCS token of the marked city this label can be proven to be associated
   * with, if any.
   */
  city?: string | null;

  /**
   * The ISO 3166 code of the country / state / province the labeled feature
   * is located in, for example `CZ` (Czechia) or `US-NV` (Nevada).
   */
  country?: string | null;

  /**
   * True (or missing) if it's recommended to show this label on the map
   * by default. The value of this attribute is largely subjective.
   */
  show?: boolean | null;

  /**
   * The ISO 8601 date of the last time this location was checked in the game
   * (usually `YYYY-MM`).
   */
  checked?: string | null;

  /**
   * Note or comment about the label or its attributes.
   */
  remark?: string | null;

  /**
   * Reference to real-life information about the labeled entity.
   * Not currently used; reserved for future expansion.
   */
  ref?: unknown;
}

/**
 * Map label.
 *
 * In addition to the metadata attributes (which all are optional), this
 * interface defines methods that all map labels should have available.
 *
 * @see https://github.com/nautofon/ats-towns/blob/main/label-metadata.md
 */
export interface Label extends LabelMeta {
  /**
   * @returns True if the map label is considered valid for display.
   *
   * Examples for map labels that aren't valid:
   * - No coordinates are available.
   * - No label text is available (e.g. feature kind is `unnamed`).
   * - No country / state could be determined (may indicate the label is
   *      for a location in a DLC that hasn't been released, or that it's
   *      located in a different game).
   */
  isValid(): boolean;

  /**
   * @returns The metadata for the map label as a shallow copy of this object.
   */
  meta(): LabelMeta;

  /**
   * @returns The map label as a GeoJSON point feature.
   *
   * @throws ReferenceError if no coordinates are available.
   *
   * @see {@link isValid}
   */
  toGeoJsonFeature(): GeoJSON.Feature<GeoJSON.Point, LabelMeta>;
}

/**
 * Map label base class.
 *
 * @see https://github.com/nautofon/ats-towns/blob/main/label-metadata.md
 */
export class GenericLabel implements Label {

  token: string | undefined;
  text: string | undefined;
  easting: number | undefined;
  southing: number | undefined;
  kind: string | undefined;
  signed: 'all' | 'most' | 'some' | 'remote' | undefined;
  access: boolean | undefined;
  industry: boolean | undefined;
  city: string | undefined;
  country: string | undefined;
  show: boolean | undefined;
  checked: string | undefined;
  remark: string | undefined;
  ref: unknown;

  /**
   * @param data - The game data provider for the label's region.
   */
  constructor(data: LabelDataProvider) {
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
  readonly target;

  /**
   * Details on the mileage target analysis results.
   * @internal
   */
  readonly analysis;

  /**
   * @param target - The {@link MileageTarget} to generate a label for.
   * @param data   - The game data provider for the target's region.
   */
  constructor(target: MileageTarget, data: LabelDataProvider) {
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
}

/**
 * Map label generated from Euro Truck Simulator 2 mileage targets.
 *
 * Contains heuristics for ETS2 `editorName` practice and the ISO country code.
 */
export class Ets2Label extends TargetLabel {
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
   * True if the mileage target seems to be for an unnamed state line crossing.
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
  readonly mileageTargets;

  /**
   * Function to transform game coordinates to geographic coordinates.
   * Uses the precision given by {@link geographicCoordinatePrecision}.
   *
   * @param feature - A GeoJSON.Feature with (projected) game coordinates.
   *
   * @returns The modified feature, now with coordinates conforming to GeoJSON.
   *
   * @see {@link clis/generator/geo-json/normalize!createNormalizeFeature}
   */
  readonly normalizeFeature;


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
  }

  /**
   * Search for a country in the game data by mileage target token country code.
   *
   * Country codes in mileage target tokens mostly follow ISO 3166
   * (but UK is used for Great Britain and XK for Kosovo).
   * In the game data, ATS uses ISO subdivisions for country codes, while
   * ETS2 uses the Distinguishing Sign of Vehicles in International Traffic.
   *
   * @param code - The mileage target country code to look up.
   *
   * @returns The {@link Country} object, or `undefined` if none was found.
   *
   * @see {@link clis/generator/geo-json/populated-places!ets2IsoA2}
   */
  countryFromCode(code: string): Country | undefined {
  }

  /**
   * Search for a country in the game data by ISO 3166-1 or ISO 3166-2 code.
   *
   * @param isoCode - The country or country and subdivision code to look up.
   *
   * @returns True if the given code identifies a country in the game data.
   *
   * @see {@link clis/generator/geo-json/populated-places!ets2IsoA2}
   */
  isValidCountry(isoCode: string): boolean {
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
   *
   * @see {@link clis/generator/geo-json/populated-places!ets2IsoA2}
   */
  isInRegion(meta: LabelMeta): boolean | undefined {
  }

  /**
   * The name of the region for which game data is provided.
   *
   * @returns `'europe' | 'usa'`
   */
  region(): RegionName {
  }

  /**
   * Reads metadata records from disk into memory.
   *
   * @param jsonPath - The path of the metadata file. Only JSON is implemented.
   *
   * @returns An array of metadata records.
   */
  static readMetas(jsonPath: string): LabelMeta[] {
  }
}
