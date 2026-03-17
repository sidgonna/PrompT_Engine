import { Router } from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import { IStorage } from "../storage/storage.interface";
import { Matrix, Dimension, DimensionValue } from "../models/schema";
import { v4 as uuidv4 } from "uuid";

// Configure multer for memory storage (file buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export function createUploadRouter(storage: IStorage): Router {
  const router = Router();

  // POST /api/upload/excel/preview
  // Parse uploaded Excel and return first 5 rows of each sheet
  router.post("/excel/preview", upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse buffer with xlsx
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      
      const sheetsData = [];
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays (AOA) to easily grab rows
        const aoa = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];
        
        // Filter out completely empty rows at the end, etc.
        const rows = aoa.filter(row => row.some(cell => String(cell).trim() !== ""));
        
        // Grab first 5 rows
        const previewRows = rows.slice(0, 5);
        
        sheetsData.push({
          sheetName,
          rowCount: rows.length,
          previewRows,
        });
      }

      res.json({ sheets: sheetsData });
    } catch (error: any) {
      console.error("Excel preview error:", error);
      res.status(500).json({ error: "Failed to parse Excel file", message: error.message });
    }
  });

  // POST /api/upload/excel/execute
  // Parse uploaded Excel and execute the mapping config
  router.post("/excel/execute", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const configStr = req.body.config;
      if (!configStr) {
        return res.status(400).json({ error: "Missing mapping config" });
      }

      const config = JSON.parse(configStr);
      // config is expected to have { sheets: [ { sheetName, action, targetMatrixId, newMatrixName, headerRowIndex, collisionStrategy } ] }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const results = { addedMatrices: 0, addedDimensions: 0, addedValues: 0, skipped: 0 };

      for (const sheetConfig of config.sheets) {
        if (sheetConfig.action === "ignore") continue;

        const worksheet = workbook.Sheets[sheetConfig.sheetName];
        if (!worksheet) continue;

        const aoa = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];
        if (aoa.length === 0) continue;

        const headerIdx = sheetConfig.headerRowIndex || 0;
        const headers = aoa[headerIdx] || [];
        const valueRows = aoa.slice(headerIdx + 1);

        let matrix: Matrix | undefined;

        if (sheetConfig.action === "new_project") {
          const matrixId = uuidv4();
          matrix = await storage.saveMatrix({
            id: matrixId,
            name: sheetConfig.newMatrixName || sheetConfig.sheetName,
            dimensions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          results.addedMatrices++;
        } else if (sheetConfig.action === "append" || sheetConfig.action === "replace") {
          if (!sheetConfig.targetMatrixId) continue;
          const found = await storage.getMatrix(sheetConfig.targetMatrixId);
          if (found) matrix = found;
          if (!matrix) continue;
        }

        if (!matrix) continue;

        // Process columns (Dimensions)
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
          const rawHeader = headers[colIdx];
          const headerClean = String(rawHeader).trim();
          if (!headerClean) continue;

          // Find or create dimension
          let dim = matrix.dimensions.find(d => d.name.toLowerCase() === headerClean.toLowerCase());
          
          if (!dim) {
            dim = {
              id: uuidv4(),
              name: headerClean,
              enabled: true,
              selectionMode: "random",
              values: []
            };
            matrix.dimensions.push(dim);
            results.addedDimensions++;
          }

          // Handle collision strategy for existing dimension values
          if (sheetConfig.collisionStrategy === "replace") {
            dim.values = []; // wipe existing
          }

          const existingValuesSet = new Set(dim.values.map(v => v.value.trim().toLowerCase()));

          // Collect new values from rows
          for (const row of valueRows) {
            const rawVal = row[colIdx];
            if (rawVal === undefined || rawVal === null) continue;
            
            const strVal = String(rawVal).trim();
            if (!strVal) continue;

            if (sheetConfig.collisionStrategy === "skip" && existingValuesSet.has(strVal.toLowerCase())) {
              results.skipped++;
              continue;
            }

            // For both "append" and "replace" (since replace wiped the array), we add the new value
            dim.values.push({
              id: uuidv4(),
              value: strVal
            });
            existingValuesSet.add(strVal.toLowerCase());
            results.addedValues++;
          }
        }

        // Save matrix back to storage
        await storage.saveMatrix(matrix);
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Excel execute error:", error);
      res.status(500).json({ error: "Failed to execute Excel import", message: error.message });
    }
  });

  return router;
}
