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
});
