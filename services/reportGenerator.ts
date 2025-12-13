import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { StructureModel, AnalysisResults } from "../frame/types";

export const generateReport = (model: StructureModel, results: AnalysisResults, imageUri?: string) => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString();

    // --- Title & Header ---
    doc.setFontSize(22);
    doc.setTextColor(0, 102, 204);
    doc.text("Analysis Report", 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(100);

    // Text with Hyperlink
    doc.text("Created by: ", 14, 28);
    const prefixWidth = doc.getTextWidth("Created by: ");

    doc.setTextColor(0, 102, 204);
    doc.textWithLink("Structure Realm", 14 + prefixWidth, 28, { url: 'https://structurerealm.com/contact' });

    doc.setTextColor(100);
    doc.text(`Generated on: ${dateStr}`, 14, 34);

    let yPos = 45;

    // --- Model Image ---
    if (imageUri) {
        const imgProps = doc.getImageProperties(imageUri);
        const pdfWidth = doc.internal.pageSize.getWidth();
        // Maintain aspect ratio, max width 180, max height 100
        const margin = 15;
        const maxWidth = pdfWidth - 2 * margin;
        const maxHeight = 100;

        let imgWidth = maxWidth;
        let imgHeight = (imgProps.height * maxWidth) / imgProps.width;

        if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = (imgProps.width * maxHeight) / imgProps.height;
        }

        // Center image
        const xPos = (pdfWidth - imgWidth) / 2;
        doc.addImage(imageUri, 'PNG', xPos, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
    }

    // --- Input Data Section ---
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("1. Structure Definitions", 14, yPos);
    yPos += 6;

    // Nodes Table
    autoTable(doc, {
        startY: yPos,
        head: [['Node ID', 'X', 'Y']],
        body: model.nodes.map(n => [n.id, n.x, n.y]),
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Members Table
    const memberRows = model.members.map(m => {
        let rawType = m.type || 'beam';
        // Handle legacy 'rigid' type as 'beam'
        if (rawType === ('rigid' as any)) rawType = 'beam';

        let typeStr = "Beam";
        if (rawType === 'truss') typeStr = "Truss";
        if (rawType === 'spring') typeStr = "Spring";

        let E = "NA", A = "NA", I = "NA", k = "NA";

        if (rawType === 'beam') {
            E = m.eModulus ? m.eModulus.toExponential(2) : "-";
            A = m.area ? m.area.toExponential(2) : "-";
            I = m.momentInertia ? m.momentInertia.toExponential(2) : "-";
        } else if (rawType === 'truss') {
            E = m.eModulus ? m.eModulus.toExponential(2) : "-";
            A = m.area ? m.area.toExponential(2) : "-";
        } else if (rawType === 'spring') {
            k = m.springConstant ? m.springConstant.toString() : "-";
        }

        return [m.id, m.startNodeId, m.endNodeId, typeStr, E, A, I, k];
    });

    doc.text("Members", 14, yPos - 3);
    autoTable(doc, {
        startY: yPos,
        head: [['ID', 'Start', 'End', 'Type', 'E', 'A', 'I', 'k']],
        body: memberRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Supports Table
    doc.text("Supports", 14, yPos - 3);
    autoTable(doc, {
        startY: yPos,
        head: [['Node', 'Type']],
        body: model.supports.map(s => [s.nodeId, s.type]),
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // --- Results Section ---
    if (results && results.isStable) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(14);
        doc.text("2. Analysis Results", 14, yPos);
        yPos += 8;

        // Displacements
        doc.setFontSize(11);
        doc.text("Nodal Displacements", 14, yPos);
        yPos += 2;

        const dispRows = Object.entries(results.displacements).map(([id, d]) => [
            id, d.x.toExponential(4), d.y.toExponential(4), d.rotation.toExponential(4)
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Node', 'dx', 'dy', 'Rotation']],
            body: dispRows,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] } // Green header
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;

        // Reactions
        doc.text("Support Reactions", 14, yPos);
        yPos += 2;
        const rxnRows = Object.entries(results.reactions).map(([id, r]) => [
            id, r.fx.toFixed(3), r.fy.toFixed(3), r.moment.toFixed(3)
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Node', 'Fx', 'Fy', 'Moment']],
            body: rxnRows,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] }
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;

        // Stiffness Matrix
        // Prioritize reduced stiffness matrix
        const K = results.reducedStiffnessMatrix || results.stiffnessMatrix;
        const title = results.reducedStiffnessMatrix ? "3. Reduced Stiffness Matrix (Free DOFs)" : "3. Global Stiffness Matrix (K)";

        if (K && K.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text(title, 14, 20);

            const kRows = K.map(row => row.map(val => {
                // Handle small epsilon
                if (Math.abs(val) < 1e-10) return "0";
                // Clean up number formatting
                if (Math.abs(val) >= 1000 || Math.abs(val) <= 0.001) {
                    return val.toExponential(2);
                }
                return val.toFixed(1);
            }));

            // Create header (Index 1, 2, 3...)
            const kHeader = K.map((_, i) => `${i + 1}`);

            // Increase limit to 40 columns
            if (K.length > 40) {
                doc.setFontSize(10);
                doc.text("Matrix size is too large to display (" + K.length + "x" + K.length + ").", 14, 30);
            } else {
                // Calculate styling based on size to fit page
                const fontSize = K.length > 15 ? 5 : 7;
                const cellPadding = K.length > 20 ? 0.5 : 1.5;

                autoTable(doc, {
                    startY: 25,
                    head: [kHeader],
                    body: kRows,
                    theme: 'plain',
                    styles: { fontSize: fontSize, cellPadding: cellPadding, halign: 'center', lineWidth: 0.1, lineColor: 200 },
                    columnStyles: { 0: { fontStyle: 'bold' } },
                    // Use all available width
                    margin: { left: 5, right: 5 }
                });
            }
        }

    } else {
        doc.setTextColor(200, 0, 0);
        doc.text("Analysis failed or structure is unstable.", 14, yPos);
    }

    doc.save("StructureRealm_Report.pdf");
};