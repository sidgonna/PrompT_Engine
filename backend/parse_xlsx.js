const xlsx = require('xlsx');
const path = require('path');

const filePath = 'd:/Workoe/Freelance/Master Prompter/app_brief/prompt_generator_seed.xlsx';
const workbook = xlsx.readFile(filePath);

console.log('--- EXCEL STRUCTURE ---');
workbook.SheetNames.forEach(name => {
  const sheet = workbook.Sheets[name];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const headers = data[0] || [];
  console.log(`Sheet: ${name}`);
  console.log(`Headers: ${headers.join(', ')}`);
  console.log('---');
});
