import { parseSii } from '../sii-parser';
import { jsonConverter } from '../sii-visitors';

describe('JsonConverterVisitor', () => {
  it('parses escaped UTF-8', () => {
    const text = `
utf8 : escaped {
 ascii: "\\x7e\\x00"
 two_bytes: "\\xC4\\x80\\xd5\\xBf"
 three_bytes: "\\xe7\\xa6\\x85"
 four_bytes: "\\xf0\\x9f\\x98\\x80"
 invalid: "\\x80"
}
    `;
    const res = parseSii(text);
    expect(jsonConverter.convert(res.cst)).toEqual({
      utf8: {
        escaped: {
          ascii: '~\0',
          twoBytes: 'Āտ',
          threeBytes: '禅',
          fourBytes: '😀',
          invalid: '�',
        },
      },
    });
  });

  it('parses icon mat files with SDF data', () => {
    const text = `
effect : "ui.sdf.rfx" {
\taux[0] : { 32.00000, 32.00000, 2.00000, 0.00000 }
\taux[1] : { 0.02315, 0.04667, 0.27889, 1.00000 }
\taux[2] : { 1.00000, 1.00000, 1.00000, 1.00000 }
\taux[3] : { 0.00000, 0.00000, 0.00000, 0.00000 }
\taux[4] : { 0.00000, 0.00000, 0.00000, 0.00000 }
\ttexture : "texture" {
\t\tsource : "road_border_ico.tobj"
\t\tu_address : clamp
\t\tv_address : clamp
\t}
}    
    `;

    const res = parseSii(text);
    expect(jsonConverter.convert(res.cst)).toEqual({
      effect: {
        'ui.sdf.rfx': {
          aux: [
            [32, 32, 2, 0],
            [0.02315, 0.04667, 0.27889, 1.0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          texture: {
            texture: {
              source: 'road_border_ico.tobj',
              uAddress: 'clamp',
              vAddress: 'clamp',
            },
          },
        },
      },
    });
  });

  it('parses mileage target se_malmo', () => {
    const text = `
SiiNunit
{
mileage_target : mileage.se_malmo {
 editor_name: malmo
 default_name: "MALM\\xc3\\x96"
 variants: 1
 variants[0]: dk_malmo
 names: 1
 names[0]: "Malm\\xc3\\xb8"
 image_atlas_paths: 0
 image_atlas_indices: 0
 distance_offset: 0
 node_uid: nil
 position: (&46279880, &40e7cdb1, &c6d74b34)
 search_radius: 500
}
}
    `;

    const res = parseSii(text);
    expect(jsonConverter.convert(res.cst)).toEqual({
      mileageTarget: {
        'mileage.se_malmo': {
          editorName: 'malmo',
          defaultName: 'MALMÖ',
          distanceOffset: 0,
          imageAtlasIndices: 0,
          imageAtlasPaths: 0,
          names: ['Malmø'],
          nodeUid: undefined,
          position: [10726.125, 7.243858814239501953125, -27557.6015625],
          searchRadius: 500,
          variants: ['dk_malmo'],
        },
      },
    });
  });

  it('parses mileage target ok_seiling', () => {
    const text = `
SiiNunit
{
mileage_target : mileage.ok_seiling {
 editor_name: "OK Seiling"
 default_name: Seiling
 variants: 0
 names: 0
 image_atlas_paths: 0
 image_atlas_indices: 0
 distance_offset: &40200000
 node_uid: 5427112652697371218
 position: (&7f7fffff, &7f7fffff, &7f7fffff)
 search_radius: -1
}
}
    `;

    const res = parseSii(text);
    expect(jsonConverter.convert(res.cst)).toEqual({
      mileageTarget: {
        'mileage.ok_seiling': {
          editorName: 'OK Seiling',
          defaultName: 'Seiling',
          distanceOffset: 2.5,
          imageAtlasIndices: 0,
          imageAtlasPaths: 0,
          names: 0,
          nodeUid: 5427112652697371218n,
          position: [null, null, null],
          searchRadius: -1,
          variants: 0,
        },
      },
    });
  });
});
