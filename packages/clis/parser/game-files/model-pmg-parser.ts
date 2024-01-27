import type { ModelDescription } from '@truckermudgeon/map/types';
import * as r from 'restructure';
import { logger } from '../logger';
import { float3, uint64le } from './restructure-helpers';

// based on https://github.com/sk-zk/TruckLib/blob/5b7ae044fef4d6541ff73dff39267231e6433810/TruckLib/Model/Model.cs

const PmgHeader = new r.Struct({
  version: r.uint8, // 21
  magic: new r.String(3), // "Pmg", but reversed
  numPieces: r.uint32le,
  numParts: r.uint32le,
  numBones: r.uint32le,
  weightWidth: r.uint32le,
  numLocators: r.uint32le,
  skeletonHash: uint64le,
  bboxCenter: float3,
  bboxDiagonal: r.floatle,
  bboxStart: float3,
  bboxEnd: float3,
  // ignore the rest.
});

export function parseModelPmg(buffer: Buffer): ModelDescription {
  const version = buffer.readUint8();
  if (version !== 21) {
    logger.error('unknown .pmg file version', version);
    throw new Error();
  }

  const header = PmgHeader.fromBuffer(buffer);
  if (header.magic !== 'gmP') {
    logger.error('unexpected pmg signature', header.magic);
    throw new Error();
  }

  const [cx, , cz] = header.bboxCenter;
  const [sx, sy, sz] = header.bboxStart;
  const [ex, ey, ez] = header.bboxEnd;

  return {
    center: { x: cx, y: cz },
    start: { x: sx, y: sz },
    end: { x: ex, y: ez },
    height: ey - sy,
  };
}
