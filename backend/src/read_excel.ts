import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const filePath = path.resolve(__dirname, '../../app_brief/prompt_generator_seed.xlsx');
const workbook = xlsx.readFile(filePath);

const result: any = {};
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet) as any[];
  result[sheetName] = {
    rowCount: rows.length,
    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    preview: rows.slice(0, 3)
  };
}
fs.writeFileSync('output.json', JSON.stringify(result, null, 2));
