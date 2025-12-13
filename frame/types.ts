export interface Node {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export type MemberType = 'beam' | 'truss' | 'spring';

export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  // Properties
  eModulus?: number;
  area?: number;
  momentInertia?: number;
  springConstant?: number; // k
  type: MemberType;
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
  NODAL_POINT = 'nodal_point',
  MEMBER_POINT = 'member_point',
  MEMBER_DISTRIBUTED = 'member_distributed'
}

export interface Load {
  id: string;
  type: LoadType;
  nodeId?: string;
  memberId?: string;
  magnitudeX: number;
  magnitudeY: number;
  moment?: number;
  location?: number; // Distance from start node for member point loads
}

export interface StructureModel {
  nodes: Node[];
  members: Member[];
  supports: Support[];
  loads: Load[];
}

export interface AnalysisResults {
  displacements: { [nodeId: string]: { x: number; y: number; rotation: number } };
  reactions: { [nodeId: string]: { fx: number; fy: number; moment: number } };
  memberForces: {
    [memberId: string]: {
      start: { fx: number; fy: number; moment: number };
      end: { fx: number; fy: number; moment: number };
    }
  };
  stiffnessMatrix?: number[][];
  reducedStiffnessMatrix?: number[][];
  isStable: boolean;
  message: string;
}