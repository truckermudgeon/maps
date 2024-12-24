import { parseSii } from '../sii-parser';

describe('parseSii', () => {
  function expectToParse(text: string) {
    const res = parseSii(text);
    if (!res.ok) {
      console.log(res.input);
    }
    expect(res.lexErrors).toEqual([]);
    expect(res.parseErrors).toEqual([]);
  }

  it('parses an empty sii file', () => {
    const text = `
SiiNunit
{
}   
    `;
    expectToParse(text);
  });

  it('parses a single-entry sui file', () => {
    const text = `
cargo_data: cargo.bottles
{
\tname: "@@cn_bottles@@"
\tfragility: 0.9
\tgroup[]: containers
\tvolume: 3.9
\tmass: 715.3
\tunit_reward_per_km: 0.635
\tunit_load_time: 117
\tbody_types[]: dryvan
\tbody_types[]: refrigerated
\tbody_types[]: insulated
}
`;
    expectToParse(text);
  });

  it('parses files with comments', () => {
    const text = `
SiiNunit
{
# For modders: Please do not modify this file if you want to add a new entry. Create in
# this directory a new file "[base_name].[idofyourmod].sii" where [base_name] is name of
# base file without the extension (e.g. "climate" for "/def/climate.sii") and idofyourmod> is
# some string which is unlikely to conflict with other mod.
#
# Warning: Even if the units are specified in more than one source file, they share the
# same namespace so suffixes or prefixes should be used to avoid conflicts.

climate_profile : climate.reference {
\tbad_weather_factor: 0.0
\twetting_factor: 0.4
\tdrying_factor: 0.01

\t// Globe coordinates (in degrees) are based on map position:
\t// latitude = map_origin[0] + map_z * map_factor[0]
\t// longitude = map_origin[1] + map_x * map_factor[1]
\t//
\t// If advanced map projection is used (eg lambert) projection is applied on coordinates accordingly.

\tmap_projection: lambert_conic
\tstandard_paralel_1: 33
\tstandard_paralel_2: 45

\tmap_origin: (39, -96) // lat, lon
\tmap_factor: (-1.7706234e-4, 1.76689948e-4)
}

}
    `;

    expectToParse(text);
  });

  it('parses @include directives', () => {
    const text = `
SiiNunit
{

@include "country/california.sui"
@include "country/nevada.sui"
@include "country/arizona.sui"
@include "country/new_mexico.sui"
@include "country/oregon.sui"
@include "country/utah.sui"
@include "country/washington.sui"
@include "country/idaho.sui"
@include "country/colorado.sui"
@include "country/wyoming.sui"
@include "country/montana.sui"
@include "country/texas.sui"

}
    `;
    expectToParse(text);
  });

  it('parses nested @include directives', () => {
    const text = `
SiiNunit
{
accessory_paint_job_data : paintjob_bx1.scs.box.paint_job
{
@include "paintjob_bx1_settings.sui"
\tpaint_job_mask: "/vehicle/trailer_owned/upgrade/paintjob/scs_box/paintjob_bx1/pjm_at_0x0_size_2x2.tobj"
}
}   
    `;
    expectToParse(text);
  });

  it('parses object property values that start with a number', () => {
    const text = `
prefab_model : prefab.us_29n
{
\tname: "us_cross_2-1-2_city_t_1-1_country"
\tmodel_desc: "/prefab/cross_temp/us_cross_2-1-2_city_t_1-1_country_tmpl.pmd"
\tprefab_desc: "/prefab/cross_temp/us_cross_2-1-2_city_t_1-1_country_tmpl.ppd"

\tdynamic_lod_desc[]: "/prefab/cross_temp/us_cross_2-1-2_city_t_1-1_country_tmpl_lod1.pmd"
\tdynamic_lod_dist[]: 171

\tcorner0[]: shcr
\tcorner0[]: kbc
\tcorner0[]: swc
\tcorner0[]: swcb
\tcorner0[]: swc1p1
\tcorner1[]: shcl
\tcorner1[]: kbc
\tcorner1[]: swc
\tcorner1[]: swcb
\tcorner1[]: swc1p1
\tcorner2[]: sh47
\tcorner2[]: kb47
\tcorner2[]: sw47

\tsemaphore_profile[]: 2x1_v2
\tsemaphore_profile[]: 212t111_v2
\tsemaphore_profile[]: 212t111_v2

}
    `;
    expectToParse(text);
  });

  it('parses binary float numbers', () => {
    const text = `
binary_float : .test {
 zero: &00000000
 no_data: &7f7fffff
 mixed: (&c72bb452, 120, &c601f2d8)
}
    `;
    expectToParse(text);
    const res = parseSii(text);
    expect(res.input[6].tokenType.name).toBe('BinaryFloat');
    expect(res.input[6].image).toBe('&00000000');
    expect(res.input[9].tokenType.name).toBe('BinaryFloat');
    expect(res.input[9].image).toBe('&7f7fffff');
    expect(res.input[13].tokenType.name).toBe('BinaryFloat');
    expect(res.input[13].image).toBe('&c72bb452');
    expect(res.input[15].tokenType.name).toBe('NumberLiteral');
    expect(res.input[15].image).toBe('120');
    expect(res.input[17].tokenType.name).toBe('BinaryFloat');
    expect(res.input[17].image).toBe('&c601f2d8');
  });

  it('parses country files', () => {
    const text = `
    country_data : country.data.california
{
\tcountry_id: 1

\tname: "California"
\tname_localized: "@@california@@"
\tcountry_code: "CA"
\tiso_country_code: usca

\tpos: (-100000, 0, 4000)

\tfuel_price: 1.6745866\t# $6.339/gallonUS = $1.6745866/litre

\tlights_mandatory: false
\timperial_units: true
\tdriving_tired_offence: true

\ttime_zone: -420\t\t# -7 hours in minutes
\ttime_zone_name: "@@tz_pdt@@"

\tmass_limit_per_axle_count[]: 18143.7\t# 40000 lb\t# 2-axle vehicle
\tmass_limit_per_axle_count[]: 27215.6\t# 60000 lb
\tmass_limit_per_axle_count[]: 36287.4\t# 80000 lb
}


    `;
    expectToParse(text);
  });

  it('parses prefab files', () => {
    const text = `
SiiNunit
{

prefab_model : prefab.d_farm_mkt1
{
\tname: "wy livestock auction"
\tmodel_desc: "/prefab/depots/livestock/wy_livestock_auction.pmd"
\tprefab_desc: "/prefab/depots/livestock/wy_livestock_auction.ppd"
\tcategory: ""

\tdynamic_lod_desc: 1
\tdynamic_lod_dist: 1
\tdynamic_lod_desc[0]: "/prefab/depots/livestock/wy_livestock_auction_lod1.pmd"
\tdynamic_lod_dist[0]: 100
}

prefab_model : prefab.14buv
{
\tname: "fr r2 one way x r1 narrow t tmpl"
\tmodel_desc: "/prefab2/fork_temp/fr/fr_r2_one_way_x_r1_narrow_t_tmpl.pmd"
\tprefab_desc: "/prefab2/fork_temp/fr/fr_r2_one_way_x_r1_narrow_t_tmpl.ppd"
\tcategory: "dlc_fr"

\tcorner0[]: 1405b
\tcorner1[]: 1405a
\tcorner2[]: 1405c
}

}

    `;
    expectToParse(text);
  });

  it('parses mat files', () => {
    const text = `
effect : "ui.rfx" {
\ttexture : "texture" {
\t\tsource : "road_agri_check.tobj"
\t\tu_address : clamp
\t\tv_address : clamp
\t\tmip_filter : none
\t}
}
    `;
    expectToParse(text);
  });
});
