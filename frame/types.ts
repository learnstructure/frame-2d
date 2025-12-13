export interface Node {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  eModulus: number; // GPa
  area: number;     // m^2
  momentInertia: number; // m^4
  type: 'rigid' | 'truss';
}

export enum SupportType {
  PIN = 'pin',
  ROLLER = 'roller',
  FIXED = 'fixed'
}

export interface Support {
  id: string;
  nodeId: string;
  type: SupportType;
}

export enum LoadType {
  POINT = 'point',
  DISTRIBUTED = 'distributed'
}

export interface Load {
  id: string;
  type: LoadType;
  // If point load, applies to node (usually) or member (intermediate)
  // For simplicity in this UI, point loads apply to nodes
  nodeId?: string; 
  memberId?: string; // For distributed
  magnitudeX: number; // kN
  magnitudeY: number; // kN
  moment?: number; // kNm
}

export interface StructureModel {
  nodes: Node[];
  members: Member[];
  supports: Support[];
  loads: Load[];
}