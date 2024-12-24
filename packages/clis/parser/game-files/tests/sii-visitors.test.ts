import { parseSii } from '../sii-parser';
import { jsonConverter } from '../sii-visitors';

describe('JsonConverterVisitor', () => {
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

  it('parses mileage target ok_oklacity', () => {
    const text = `
SiiNunit
{
mileage_target : mileage.ok_oklacity {
 editor_name: "OK Oklahoma City"
 default_name: "Oklahoma City"
 variants: 1
 variants[0]: okla_city
 names: 1
 names[0]: "Okla. City"
 image_atlas_paths: 0
 image_atlas_indices: 0
 distance_offset: 2
 node_uid: nil
 position: (&c5e2cc07, &41ac8cd9, &46985370)
 search_radius: 50
}
}
    `;

    const res = parseSii(text);
    expect(jsonConverter.convert(res.cst)).toEqual({
      mileageTarget: {
        'mileage.ok_oklacity': {
          editorName: 'OK Oklahoma City',
          defaultName: 'Oklahoma City',
          distanceOffset: 2,
          imageAtlasIndices: 0,
          imageAtlasPaths: 0,
          names: ['Okla. City'],
          nodeUid: undefined,
          position: [-7257.50341796875, 21.56877326965332, 19497.71875],
          searchRadius: 50,
          variants: ['okla_city'],
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
