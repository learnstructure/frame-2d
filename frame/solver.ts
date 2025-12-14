import { StructureModel, AnalysisResults, LoadType, SupportType } from './types';

// --- Linear Algebra Helpers (Mimicking Numpy) ---
const NP = {
    zeros: (rows: number, cols?: number): number[][] | number[] => {
        if (cols === undefined) return new Array(rows).fill(0);
        return Array(rows).fill(0).map(() => Array(cols).fill(0));
    },

    matmul: (A: number[][], B: number[][] | number[]): any => {
        const rowsA = A.length;
        const colsA = A[0].length;
        const isVector = !Array.isArray(B[0]);

        if (isVector) {
            const bVec = B as number[];
            if (colsA !== bVec.length) throw new Error("Shape mismatch");
            const result = new Array(rowsA).fill(0);
            for (let i = 0; i < rowsA; i++) {
                for (let j = 0; j < colsA; j++) {
                    result[i] += A[i][j] * bVec[j];
                }
            }
            return result;
        } else {
            const bMat = B as number[][];
            const colsB = bMat[0].length;
            if (colsA !== bMat.length) throw new Error("Shape mismatch");
            const result = NP.zeros(rowsA, colsB) as number[][];
            for (let i = 0; i < rowsA; i++) {
                for (let j = 0; j < colsB; j++) {
                    for (let k = 0; k < colsA; k++) {
                        result[i][j] += A[i][k] * bMat[k][j];
                    }
                }
            }
            return result;
        }
    },

    transpose: (A: number[][]): number[][] => {
        return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
    },

    solve: (A: number[][], b: number[]): number[] => {
        // Gaussian elimination with partial pivoting
        const n = A.length;
        const M = A.map(row => [...row]);
        const x = [...b];

        for (let i = 0; i < n; i++) {
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
            }

            [M[i], M[maxRow]] = [M[maxRow], M[i]];
            [x[i], x[maxRow]] = [x[maxRow], x[i]];

            if (Math.abs(M[i][i]) < 1e-12) continue; // Singular handling done by caller check usually

            for (let k = i + 1; k < n; k++) {
                const factor = M[k][i] / M[i][i];
                x[k] -= factor * x[i];
                for (let j = i; j < n; j++) M[k][j] -= factor * M[i][j];
            }
        }

        const res = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            if (Math.abs(M[i][i]) < 1e-12) {
                res[i] = 0; // Free movement if singular (simplified)
            } else {
                let sum = 0;
                for (let j = i + 1; j < n; j++) sum += M[i][j] * res[j];
                res[i] = (x[i] - sum) / M[i][i];
            }
        }
        return res;
    },

    ix_: (matrix: number[][], rows: number[], cols: number[]): number[][] => {
        const res = NP.zeros(rows.length, cols.length) as number[][];
        for (let i = 0; i < rows.length; i++) {
            for (let j = 0; j < cols.length; j++) {
                res[i][j] = matrix[rows[i]][cols[j]];
            }
        }
        return res;
    },

    // Helpers to manipulate matrix directly
    addToSubmatrix: (target: number[][], source: number[][], rows: number[], cols: number[]) => {
        for (let i = 0; i < rows.length; i++) {
            for (let j = 0; j < cols.length; j++) {
                target[rows[i]][cols[j]] += source[i][j];
            }
        }
    }
};

// --- Python Ported Logic ---

function transformation_matrix(s: number, c: number, dof = 6): number[][] {
    const t = [
        [c, s, 0, 0, 0, 0],
        [-s, c, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, s, 0],
        [0, 0, 0, -s, c, 0],
        [0, 0, 0, 0, 0, 1]
    ];

    if (dof === 6) return t;

    // For truss (dof=4), remove rows/cols 2 and 5 (index 2 and 5)
    // The python code: np.delete(np.delete(t, [2, -1], axis=0), [2, -1], axis=1)
    // Indices: 0, 1, 2(rem), 3, 4, 5(rem)
    const keep = [0, 1, 3, 4];
    return NP.ix_(t, keep, keep);
}

class BeamElement {
    A: number; E: number; I: number; l: number; s: number; c: number;

    constructor(A: number, E: number, I: number, l: number, s: number, c: number) {
        this.A = A; this.E = E; this.I = I; this.l = l; this.s = s; this.c = c;
    }

    beam_local_stiffness_matrix() {
        const { E, A, I, l } = this;
        const c1 = A * E / l;
        const c2 = E * I / Math.pow(l, 3);

        return [
            [c1, 0, 0, -c1, 0, 0],
            [0, 12 * c2, 6 * c2 * l, 0, -12 * c2, 6 * c2 * l],
            [0, 6 * c2 * l, 4 * c2 * Math.pow(l, 2), 0, -6 * c2 * l, 2 * c2 * Math.pow(l, 2)],
            [-c1, 0, 0, c1, 0, 0],
            [0, -12 * c2, -6 * c2 * l, 0, 12 * c2, -6 * c2 * l],
            [0, 6 * c2 * l, 2 * c2 * Math.pow(l, 2), 0, -6 * c2 * l, 4 * c2 * Math.pow(l, 2)]
        ];
    }

    beam_stiffness_matrix() {
        const k_local = this.beam_local_stiffness_matrix();
        const t = transformation_matrix(this.s, this.c);
        const tT = NP.transpose(t);
        const k_global = NP.matmul(tT, NP.matmul(k_local, t));
        return { k_local, k_global };
    }
}

class SpringElement {
    k: number; s: number; c: number;
    constructor(k: number, s: number, c: number) {
        this.k = k; this.s = s; this.c = c;
    }

    spring_local_stiffness_matrix() {
        const k = this.k;
        return [
            [k, 0, -k, 0],
            [0, 0, 0, 0],
            [-k, 0, k, 0],
            [0, 0, 0, 0]
        ];
    }

    spring_stiffness_matrix() {
        const k_local = this.spring_local_stiffness_matrix();
        const t = transformation_matrix(this.s, this.c, 4);
        const tT = NP.transpose(t);
        const k_global = NP.matmul(tT, NP.matmul(k_local, t));
        return { k_local, k_global };
    }
}

class Structure {
    nodes: any = {};
    elements: any = {};
    K: number[][] = [];
    K_reduced: number[][] = [];
    node_load: number[] = [];
    eq_node_load: number[] = [];
    eff_node_load: number[] = [];
    node_load_reduced: number[] = [];
    free_dof: number[] = [];
    fix_dof: number[] = [];
    node_displacements: number[] = [];
    free_dof_displacements: number[] = [];
    reactions: number[] = [];

    // Map string IDs to integers (1-based)
    idMap: { [key: string]: number } = {};
    nodeCount = 0;
    elemCount = 0;

    add_node(idStr: string, x: number, y: number) {
        this.nodeCount++;
        this.idMap[idStr] = this.nodeCount;
        this.nodes[this.nodeCount] = { id: this.nodeCount, idStr, x, y };
    }

    get_id(idStr: string) { return this.idMap[idStr]; }

    get_length_sine_cosine(node_i: number, node_j: number) {
        const del_x = this.nodes[node_j]["x"] - this.nodes[node_i]["x"];
        const del_y = this.nodes[node_j]["y"] - this.nodes[node_i]["y"];
        const length = Math.sqrt(del_x ** 2 + del_y ** 2);
        // Avoid division by zero
        if (length === 0) return { length: 0.0001, sine: 0, cosine: 1 };
        const sine = del_y / length;
        const cosine = del_x / length;
        return { length, sine, cosine };
    }

    add_frame(idStr: string, node_i_str: string, node_j_str: string, E = 1, A = 10, I = 1) {
        this.elemCount++;
        const id = this.elemCount;
        const node_i = this.get_id(node_i_str);
        const node_j = this.get_id(node_j_str);
        const { length, sine, cosine } = this.get_length_sine_cosine(node_i, node_j);

        this.elements[id] = {
            id, idStr, node_i, node_j, length, sine, cosine, E, A, I, type: "frame"
        };
    }

    add_spring(idStr: string, node_i_str: string, node_j_str: string, k: number) {
        this.elemCount++;
        const id = this.elemCount;
        const node_i = this.get_id(node_i_str);
        const node_j = this.get_id(node_j_str);
        const { length, sine, cosine } = this.get_length_sine_cosine(node_i, node_j);

        this.elements[id] = {
            id, idStr, node_i, node_j, length, sine, cosine, k, type: "spring"
        };
    }

    add_support(node_id_str: string, type = [0, 0, 0]) {
        const node_id = this.get_id(node_id_str);
        if (node_id) this.nodes[node_id]["support"] = type;
    }

    add_node_load(node_id_str: string, load: number[]) {
        const node_id = this.get_id(node_id_str);
        if (node_id) {
            const existing = this.nodes[node_id]["load"] || [0, 0, 0];
            this.nodes[node_id]["load"] = [existing[0] + load[0], existing[1] + load[1], existing[2] + load[2]];
        }
    }

    add_distributed_load(idStr: string, w: number, type = "udl", location?: number) {
        // Find numeric ID
        const id = Object.values(this.elements).find((e: any) => e.idStr === idStr) as any;
        if (!id) return;
        const elId = id.id;

        const L = this.elements[elId]["length"];
        if (type === "udl") {
            this.elements[elId]["udl"] = w;
            this.elements[elId]["eq_load"] = [0, w * L / 2, w * L ** 2 / 12, 0, w * L / 2, -w * L ** 2 / 12];
        }
        else if (type === "triangular_sym") {
            this.elements[elId]["triangular_sym"] = w;
            this.elements[elId]["eq_load"] = [0, w * L / 4, 5 * w * L ** 2 / 96, 0, w * L / 4, -5 * w * L ** 2 / 96];
        }
        else if (type === "point") {
            const P = w;
            const a = location || L / 2;
            const b = L - a;

            // FEMs (Actions on beam ends)
            const M_start_fem = P * a * (b ** 2) / (L ** 2); // CCW +
            const M_end_fem = -P * (a ** 2) * b / (L ** 2);  // CW - (so numeric negative)

            const V_start_fem = P * (b ** 2) * (3 * a + b) / (L ** 3);
            const V_end_fem = P * (a ** 2) * (a + 3 * b) / (L ** 3);

            this.elements[elId]["eq_load"] = [
                0,
                V_start_fem,
                M_start_fem,
                0,
                V_end_fem,
                M_end_fem
            ];
        }
    }

    calculate_element_stiffness_matrix(id: number) {
        const data = this.elements[id];
        if (data["type"] === "frame") {
            const beam = new BeamElement(data["A"], data["E"], data["I"], data["length"], data["sine"], data["cosine"]);
            const { k_local, k_global } = beam.beam_stiffness_matrix();
            data["k_local"] = k_local;
            return k_global;
        } else if (data["type"] === "spring") {
            const spring = new SpringElement(data["k"], data["sine"], data["cosine"]);
            const { k_local, k_global } = spring.spring_stiffness_matrix();
            data["k_local"] = k_local;

            // Expand 4x4 to 6x6 for assembly
            const k_expanded = NP.zeros(6, 6) as number[][];
            // Indices mapping: 0,1 -> 0,1 (xi, yi); 2,3 -> 3,4 (xj, yj). Rotations (2, 5) are 0.
            const map = [0, 1, 3, 4];
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    k_expanded[map[r]][map[c]] = k_global[r][c];
                }
            }
            return k_expanded;
        }
        throw new Error("Unknown element");
    }

    get_dofs(node_id: number) {
        const start = (node_id - 1) * 3;
        return [start, start + 1, start + 2];
    }

    get_free_dofs() {
        const dof_total = this.nodeCount * 3;
        const free_dofs_flags = new Array(dof_total).fill(1);

        for (const key in this.nodes) {
            const node = this.nodes[key];
            const dofs = this.get_dofs(node.id);
            const support = node.support || [0, 0, 0];

            if (support[0] === 1) free_dofs_flags[dofs[0]] = 0;
            if (support[1] === 1) free_dofs_flags[dofs[1]] = 0;
            if (support[2] === 1) free_dofs_flags[dofs[2]] = 0;
        }

        this.free_dof = [];
        this.fix_dof = [];
        free_dofs_flags.forEach((val, idx) => {
            if (val === 1) this.free_dof.push(idx);
            else this.fix_dof.push(idx);
        });
    }

    assemble_structure_stiffness_matrix() {
        const size = this.nodeCount * 3;
        this.K = NP.zeros(size, size) as number[][];

        for (const key in this.elements) {
            const el = this.elements[key];
            const k_el = this.calculate_element_stiffness_matrix(el.id);
            const dofs = [...this.get_dofs(el.node_i), ...this.get_dofs(el.node_j)];
            NP.addToSubmatrix(this.K, k_el, dofs, dofs);
        }
    }

    assemble_load_vector() {
        const size = this.nodeCount * 3;
        this.node_load = NP.zeros(size) as number[];

        for (const key in this.nodes) {
            const node = this.nodes[key];
            const load = node.load || [0, 0, 0];
            const dofs = this.get_dofs(node.id);
            this.node_load[dofs[0]] += load[0];
            this.node_load[dofs[1]] += load[1];
            this.node_load[dofs[2]] += load[2];
        }

        this.eq_node_load = NP.zeros(size) as number[];
        for (const key in this.elements) {
            const el = this.elements[key];
            if (el.eq_load) {
                const dofs = [...this.get_dofs(el.node_i), ...this.get_dofs(el.node_j)];
                for (let i = 0; i < 6; i++) {
                    this.eq_node_load[dofs[i]] += el.eq_load[i];
                }
            }
        }

        this.eff_node_load = this.node_load.map((v, i) => v + this.eq_node_load[i]);
    }

    find_displacements() {
        this.get_free_dofs();

        this.K_reduced = NP.ix_(this.K, this.free_dof, this.free_dof);
        this.node_load_reduced = this.free_dof.map(i => this.eff_node_load[i]);

        if (this.free_dof.length === 0) {
            this.free_dof_displacements = [];
        } else {
            try {
                this.free_dof_displacements = NP.solve(this.K_reduced, this.node_load_reduced);
            } catch (e) {
                throw new Error("Structure is unstable.");
            }
        }

        this.node_displacements = new Array(this.nodeCount * 3).fill(0);
        this.free_dof.forEach((dofIdx, i) => {
            this.node_displacements[dofIdx] = this.free_dof_displacements[i];
        });
    }

    find_reactions() {
        if (this.fix_dof.length === 0) {
            this.reactions = [];
            return;
        }

        const K_fix = NP.ix_(this.K, this.fix_dof, Array.from({ length: this.nodeCount * 3 }, (_, i) => i));
        const KU = NP.matmul(K_fix, this.node_displacements) as number[];

        const eq_fixed = this.fix_dof.map(i => this.eq_node_load[i]);
        this.reactions = KU.map((v, i) => v - eq_fixed[i]);
    }
}

function getElementForces(structure: Structure, elId: number) {
    const data = structure.elements[elId];
    let k = data["k_local"];

    if (data["type"] === "spring") {
        const k_raw = k;
        k = NP.zeros(6, 6);
        const map = [0, 1, 3, 4];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) k[map[r]][map[c]] = k_raw[r][c];
    }

    const t = transformation_matrix(data["sine"], data["cosine"]);

    const start_dofs = structure.get_dofs(data["node_i"]);
    const end_dofs = structure.get_dofs(data["node_j"]);
    const d_global = [
        ...start_dofs.map(i => structure.node_displacements[i]),
        ...end_dofs.map(i => structure.node_displacements[i])
    ];

    const d_local = NP.matmul(t, d_global);
    const kd = NP.matmul(k, d_local);
    const eq = data["eq_load"] || [0, 0, 0, 0, 0, 0];

    return kd.map((v: number, i: number) => v - eq[i]);
}

export const analyzeStructure = (model: StructureModel): AnalysisResults => {
    try {
        const structure = new Structure();

        model.nodes.forEach(n => structure.add_node(n.id, n.x, n.y));

        model.members.forEach(m => {
            if (m.type === 'spring') {
                structure.add_spring(m.id, m.startNodeId, m.endNodeId, m.springConstant || 100);
            } else {
                const E = m.eModulus || 200e9;
                const A = m.area || 0.01;
                // CHANGED: Force I to 0 for Truss type to ensure zero rotational stiffness.
                // Otherwise defaults to 0.0001 (Frame) which causes artificial rotations.
                const I = m.type === 'truss' ? 0 : (m.momentInertia || 0.0001);
                structure.add_frame(m.id, m.startNodeId, m.endNodeId, E, A, I);
            }
        });

        model.supports.forEach(s => {
            let type = [0, 0, 0];
            if (s.type === SupportType.FIXED) type = [1, 1, 1];
            else if (s.type === SupportType.PIN) type = [1, 1, 0];
            else if (s.type === SupportType.ROLLER) type = [0, 1, 0];
            structure.add_support(s.nodeId, type);
        });

        model.loads.forEach(l => {
            if (l.type === LoadType.NODAL_POINT && l.nodeId) {
                structure.add_node_load(l.nodeId, [l.magnitudeX, l.magnitudeY, l.moment || 0]);
            } else if (l.memberId) {
                if (l.type === LoadType.MEMBER_DISTRIBUTED) {
                    structure.add_distributed_load(l.memberId, l.magnitudeY, "udl");
                } else if (l.type === LoadType.MEMBER_POINT) {
                    structure.add_distributed_load(l.memberId, l.magnitudeY, "point", l.location);
                }
            }
        });

        structure.assemble_structure_stiffness_matrix();
        structure.assemble_load_vector();
        structure.find_displacements();
        structure.find_reactions();

        const displacements: any = {};
        const reactions: any = {};
        const memberForces: any = {};

        for (let i = 1; i <= structure.nodeCount; i++) {
            const node = structure.nodes[i];
            const dofs = structure.get_dofs(i);
            displacements[node.idStr] = {
                x: structure.node_displacements[dofs[0]],
                y: structure.node_displacements[dofs[1]],
                rotation: structure.node_displacements[dofs[2]]
            };
        }

        const reactionMap: { [id: string]: { fx: number, fy: number, moment: number } } = {};

        structure.fix_dof.forEach((globalDofIdx, i) => {
            const nodeIdx = Math.floor(globalDofIdx / 3) + 1;
            const localDof = globalDofIdx % 3;
            const nodeStr = structure.nodes[nodeIdx].idStr;
            const val = structure.reactions[i];

            if (!reactionMap[nodeStr]) reactionMap[nodeStr] = { fx: 0, fy: 0, moment: 0 };
            if (localDof === 0) reactionMap[nodeStr].fx = val;
            if (localDof === 1) reactionMap[nodeStr].fy = val;
            if (localDof === 2) reactionMap[nodeStr].moment = val;
        });
        Object.assign(reactions, reactionMap);

        for (const key in structure.elements) {
            const el = structure.elements[key];
            const forces = getElementForces(structure, el.id);
            memberForces[el.idStr] = {
                start: { fx: forces[0], fy: forces[1], moment: forces[2] },
                end: { fx: forces[3], fy: forces[4], moment: forces[5] }
            };
        }

        return {
            displacements,
            reactions,
            memberForces,
            stiffnessMatrix: structure.K,
            reducedStiffnessMatrix: structure.K_reduced,
            isStable: true,
            message: "Analysis Completed Successfully"
        };

    } catch (e: any) {
        console.error(e);
        return {
            displacements: {},
            reactions: {},
            memberForces: {},
            isStable: false,
            message: "Structure is unstable or inputs are invalid."
        };
    }
};