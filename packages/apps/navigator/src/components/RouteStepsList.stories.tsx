import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { BranchType } from '@truckermudgeon/navigation/constants';

import { RouteStepsList } from './RouteStepsList';

const meta = {
  title: 'Route/RouteStepsList',
  component: RouteStepsList,
} satisfies Meta<typeof RouteStepsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    route: {
      id: 'route-id',
      segments: [
        {
          key: '0-0-forward-fastest',
          steps: [
            {
              distanceMeters: 0,
              duration: 0,
              geometry: '',
              maneuver: {
                direction: BranchType.DEPART,
                lonLat: [-94.097817, 33.36806],
              },
              nodesTraveled: 0,
              trafficIcons: [],
            },
            {
              distanceMeters: 74.7535029929596,
              duration: 0,
              geometry: 'jni}PketjE}h@\\sDdCrDeCzh@eA',
              maneuver: {
                direction: 0,
                lonLat: [-94.097817, 33.36806],
              },
              nodesTraveled: 4,
              trafficIcons: [],
            },
            {
              distanceMeters: 227.81832861035127,
              duration: 0,
              geometry:
                'hni}PsftjEfBk@fAQf@Sn@k@Ra@XmADsAj@qD`@oFUoFa@mFo@mFy@iFgAiFwAcFcB}Emn@u~AiAyC_A{Cs@aDk@aDa@cDYeDOcDGeDeAoZ',
              maneuver: {
                direction: 12,
                lonLat: [-94.098588, 33.369605],
              },
              nodesTraveled: 5,
              trafficIcons: [],
            },
            {
              distanceMeters: 176.97536924245415,
              duration: 0,
              geometry:
                'zqg}Pmt{jEy@cLHuCXaBl@{B`AwBd@u@~AeBjA}@vAw@~Ag@dBOjLfA|b@z@zwAoEzRZxSK',
              maneuver: {
                direction: 2,
                lonLat: [-94.090553, 33.409428],
                banner: {
                  text: 'Lake Dr',
                },
              },
              nodesTraveled: 5,
              trafficIcons: [],
            },
            {
              distanceMeters: 255.1697796440145,
              duration: 0,
              geometry: '`wm}Pc}|jEb}@qBvRI|R\\hz@a@tf@Sbr@[tf@Ulf@UnEaD',
              maneuver: {
                direction: 0,
                lonLat: [-94.124637, 33.413897],
                laneHint: {
                  lanes: [
                    {
                      branches: [2],
                    },
                    {
                      branches: [0],
                    },
                    {
                      branches: [0, 12],
                      activeBranch: 0,
                    },
                  ],
                },
                banner: {
                  text: 'Lake Dr',
                },
                thenHint: {
                  direction: 11,
                },
              },
              nodesTraveled: 9,
              trafficIcons: [],
            },
            {
              distanceMeters: 67.74952911688226,
              duration: 0,
              geometry:
                'rhx}Pai}jErDGhAKlCg@pKsCvBs@nEsCnC}BbDcBxCmBrCuBhC}B|BcCrBiCpC{B',
              maneuver: {
                direction: 11,
                lonLat: [-94.176579, 33.415665],
                laneHint: {
                  lanes: [
                    {
                      branches: [0],
                    },
                    {
                      branches: [0, 11],
                      activeBranch: 11,
                    },
                  ],
                },
              },
              nodesTraveled: 2,
              trafficIcons: [],
            },
            {
              distanceMeters: 233.67451700892866,
              duration: 0,
              geometry:
                'hoz}Pgt~jEhDwDvBmExAaEj@eCLcAFcA?yBj@qDmAufBg@yp@l@maA',
              maneuver: {
                direction: 11,
                lonLat: [-94.18623, 33.424034],
              },
              nodesTraveled: 5,
              trafficIcons: [],
            },
            {
              distanceMeters: 144.7627300533548,
              duration: 0,
              geometry:
                'j|z}PgtfkEn@wFJcDTcDfAcI~AsHz@oC~AmHzDqM~EiMjEmMvDuM|CyMzB}MbC_N',
              maneuver: {
                direction: 1,
                lonLat: [-94.18834, 33.466699],
                laneHint: {
                  lanes: [
                    {
                      branches: [1, 0],
                      activeBranch: 1,
                    },
                    {
                      branches: [0],
                    },
                  ],
                },
              },
              nodesTraveled: 2,
              trafficIcons: [],
            },
            {
              distanceMeters: 240.0450342580953,
              duration: 0,
              geometry: '~n|}PunkkE~Fuo@`BeZt@gZr@i\\G{cC',
              maneuver: {
                direction: -1,
                lonLat: [-94.19635, 33.497891],
              },
              nodesTraveled: 2,
              trafficIcons: [],
            },
            {
              distanceMeters: 482.614988056743,
              duration: 0,
              geometry:
                'b}|}P_xskEkAwmBiBebA?sGNqG^sGn@qG~@oGpAkG~AeGpBaG|GmM|JiLlM_KnOmI~PuG|QwEnRqClRcA~OGbPR~Oj@~O~@xOnA||AjO',
              maneuver: {
                direction: 0,
                lonLat: [-94.197508, 33.538626],
                laneHint: {
                  lanes: [
                    {
                      branches: [0],
                      activeBranch: 0,
                    },
                    {
                      branches: [11],
                    },
                  ],
                },
              },
              nodesTraveled: 6,
              trafficIcons: [],
            },
            {
              distanceMeters: 12014.281181297909,
              duration: 0,
              geometry:
                'bxf~Pc_}kEjl@vFti@jCvi@bCff@|@fUJvs@bFvAl@t{@hBz{@Cv{@mAl{@cDhoK{i@dd@kBjd@gAnd@_@pd@Hld@r@fd@`B|c@rCt^fDp^lEd^vFv]|Gb]hIj\\rJj[zKd[hLfcC~hAjcDb{Afs@fY|dAvd@~`A~c@fu@|[|QvH`h@l[r@jAtnDdcBr`@lR|_@jS|^jTv]pUd\\zVvXnWbVhYzSvZxQ~[dPz\\xNl]xMt]`Mt]duAh~Dls@jsBjs@jsBzpBb|FhVxr@jNh_@~Ox^nQf^~Rp]pTv\\`V|[zY|\\|[t[x]jZf_@dYp`@dXla@hW~b@lU`|BrpAjz@pe@b}@hb@v~@h`@b`Aj^liApa@lpDjqAxs@bVpiCj_Av{Bjz@~i@`Rtj@`Qdf@bNvf@bMjg@vK`i@bJxi@dHdj@xFjj@~E~uE~^|BfEtcBpUbiAnJlj@vEncItj@jEsCd_@hEx`CfSvSfBzlAtJjmAnG~`@r@ba@A`a@o@`a@{Az`@}Bj`@aErzCiWznOaqAvzCcWrcBqNjErCluAoEdb@kDp[kJ~BeEnq@sDtq@}Cxq@_B|q@a@zq@\\xq@~Apq@`Ddq@dFbb@pCjzCvX`uAfM|BhEx{Epj@`fDxZtk@NlEqC|}Edd@fzC|XbRnCj_@vCr_@pBz_@hA|_@`@|_@Ez_@m@r_@uAr_@_Ch_@gD~^oEr^yF~]aH~P_FfFrBbpJelBtaCch@pmF_jAzTcMrAwEv^}HhsCqm@zoFqjAlsCom@rXcEnXiExXiD~XiC`]{Bh]sAl]o@n]Kp]Tj]t@f]tAfb@jC`b@rDta@zEpgL|xAnxC``@hdGjw@|_C~VbBrF~`@xPfc@lIrb@vJt\\fJ`\\lKj[tLpZxMxYvNzXvO~WpP~S`ObSzOdRrPdQjQd~@dbAryBhaCtpAzuAn_F~mFrn@|e@|GIt_B`hBpRzRpSdRv[lW`]lV~]nUxo@l^p{BtpAbmBhgAj|BxoAg@nGjgAzw@hTnLzTvKnU`K~UfJvY|JnZ|Ib[zHp[vG`\\pFl\\jEr\\bDdYlBjYlAnYj@jYaFdDkF',
              maneuver: {
                direction: -1,
                lonLat: [-94.258306, 33.575681],
              },
              nodesTraveled: 112,
              trafficIcons: [],
            },
            {
              distanceMeters: 221.87902534766724,
              duration: 0,
              geometry: 'zwnkQ{~chEdMKdMUh|@cDvaAaEvYmAjYsCbYqDzXmE~XeE',
              maneuver: {
                direction: 11,
                lonLat: [-96.431202, 32.958498],
                laneHint: {
                  lanes: [
                    {
                      branches: [0],
                    },
                    {
                      branches: [0, 11],
                      activeBranch: 11,
                    },
                    {
                      branches: [11],
                    },
                  ],
                },
                banner: {
                  text: 'Exit 47',
                },
                thenHint: {
                  direction: 1,
                },
              },
              nodesTraveled: 2,
              trafficIcons: [],
            },
            {
              distanceMeters: 570.3416432702336,
              duration: 0,
              geometry:
                'lwwkQkdehEpG_@fGy@jGk@lGa@xOyAvZg@d[xBxZfFxYhIhX`LbVhNjSfP`PzQbKhRbG|SpC`Ul@xUe@bVkBbVeDrU{FlTwMxk@gNjt@uMnt@eIbu@',
              maneuver: {
                direction: 1,
                lonLat: [-96.468797, 32.963871],
                laneHint: {
                  lanes: [
                    {
                      branches: [1],
                      activeBranch: 1,
                    },
                    {
                      branches: [0],
                    },
                  ],
                },
              },
              nodesTraveled: 5,
              trafficIcons: [],
            },
            {
              distanceMeters: 1182.79431805277,
              duration: 0,
              geometry:
                '``~kQqzvgE{Gjx@uCj^mAn^w@bJ_@lPdAlPvBhPdDdPnEzOtFpOtG`OpHpNpP|WhR~VtShVtTrUlVhThfBfcBdwDzsDlrCjnClXlXnWdYbV~YlT|ZlRz[rIdQtHtQnGbRhFnRzDxRjC~RvAbSOdS',
              maneuver: {
                direction: -1,
                lonLat: [-96.495622, 32.879641],
              },
              nodesTraveled: 8,
              trafficIcons: [],
            },
            {
              distanceMeters: 1059.9670145088694,
              duration: 0,
              geometry:
                '`utlQ_qtfE{Axq@Bhv@FtcCcBd|@}C`|@wFz{@}LppAmNhpAc\\laCcKhu@c\\jaCiG|c@kCnd@_Atd@@zd@~@xd@tBrd@pEhd@',
              maneuver: {
                direction: 0,
                lonLat: [-96.612579, 32.710496],
                laneHint: {
                  lanes: [
                    {
                      branches: [0],
                      activeBranch: 0,
                    },
                    {
                      branches: [0],
                      activeBranch: 0,
                    },
                    {
                      branches: [11],
                    },
                  ],
                },
              },
              nodesTraveled: 9,
              trafficIcons: [],
            },
            {
              distanceMeters: 115.12195582101073,
              duration: 0,
              geometry: 'r|plQifpeEpAvEd@vDnCrNpDlNjEfNjGnM~E`J|DnJpEdJbElJ',
              maneuver: {
                direction: 11,
                lonLat: [-96.595829, 32.522638],
                laneHint: {
                  lanes: [
                    {
                      branches: [0],
                    },
                    {
                      branches: [11, 0],
                      activeBranch: 11,
                    },
                  ],
                },
                banner: {
                  text: 'Exit 272',
                },
              },
              nodesTraveled: 2,
              trafficIcons: [],
            },
            {
              distanceMeters: 269.82661705134217,
              duration: 0,
              geometry:
                'xrrlQyoleEpA|DpBjDdBnDlAzCbA|Cz@~Cr@bDh@bDxApFvV|eCfGpt@lGxu@',
              maneuver: {
                direction: -1,
                lonLat: [-96.603711, 32.505548],
              },
              nodesTraveled: 4,
              trafficIcons: [],
            },
            {
              distanceMeters: 897.8472691174615,
              duration: 0,
              geometry:
                'vptlQakceE~AvHVvA^~@l@t@|@j@fA`@pAVvANvAFjDEnFLx_CqKzCE|CH|CVzCf@tCr@nC~@dChAzBrAnBzAdBfB|ApBlAvB~@zBn@`C\\bCx@bC^vp@?nDv@pDbJnl@hKjl@rJvzCd@~IjHj`B}BxDIlEbAfE~A`ExBxDjCnD~CbDnDtCzDbCfr@x_@pGhBnIVnJo@hJiBhI{CbGaE`D}E\\oFm[yuCcBiO',
              maneuver: {
                direction: 12,
                lonLat: [-96.614723, 32.461125],
                laneHint: {
                  lanes: [
                    {
                      branches: [0],
                    },
                    {
                      branches: [0, 12],
                      activeBranch: 12,
                    },
                  ],
                },
              },
              nodesTraveled: 17,
              trafficIcons: [],
            },
            {
              distanceMeters: 0,
              duration: 0,
              geometry: '',
              maneuver: {
                direction: BranchType.ARRIVE,
                lonLat: [-96.614723, 32.461125],
                banner: {
                  text: 'GARC',
                },
              },
              nodesTraveled: 0,
              trafficIcons: [],
            },
          ],
          strategy: 'shortest',
          distanceMeters: 0,
          duration: 0,
          score: 0,
        },
      ],
      distanceMeters: 0,
      duration: 0,
    },
  },
};

export const WithHighlight: Story = {
  args: {
    ...Default.args,
    onStepClick: fn(),
  },
};
