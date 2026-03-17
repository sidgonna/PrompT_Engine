import { Matrix, Dimension, Step, PromptConfig } from './models/schema';
import { extractVariables, substituteAll } from './utils/variable-parser';
import { resolveSelection } from './utils/random';
import { assemble } from './engine/assembler';
import { validateConfig } from './engine/validator';

// 1. Regex test for special chars in variable names
const template = "This is a <+ve/-ve> test with <operations/action>.";
console.log("Extracted variables:", extractVariables(template));
console.log("Substitution:", substituteAll(template, { '+ve/-ve': 'Positive', 'operations/action': 'Jump' }, {}));

// 2. Test empty dimension values
const emptyDim: Dimension = {
  id: 'dim_empty', name: 'Empty', enabled: true, selectionMode: 'random', values: []
};
try {
  resolveSelection(emptyDim);
} catch (e: any) {
  console.log("resolveSelection on empty dimension throws:", e.message);
}

// 3. Test matrix with varying column lengths
const dimA: Dimension = {
  id: 'dim_a', name: 'A', enabled: true, selectionMode: 'random', 
  values: [{ id: 'a1', value: '1' }]
};
const dimB: Dimension = {
  id: 'dim_b', name: 'B', enabled: true, selectionMode: 'random', 
  values: [{ id: 'b1', value: 'X' }, { id: 'b2', value: 'Y' }]
};
const matrix: Matrix = { id: 'm1', name: 'M', dimensions: [dimA, dimB, emptyDim], createdAt: '', updatedAt: '' };

const config: PromptConfig = {
  id: 'c1', name: 'C', matrixId: 'm1', mode: 'single',
  steps: [
    { id: 's1', type: 'pick', dimensionRef: 'dim_a', enabled: true, label: 'SA', order: 0, template: '' },
    { id: 's2', type: 'pick', dimensionRef: 'dim_b', enabled: true, label: 'SB', order: 1, template: '' },
    { id: 's3', type: 'ref', stepRefs: ['s1', 's2'], enabled: true, label: 'SC', order: 2, template: '<A> and <B>!' }
  ],
  outputSettings: { outputType: ['text'] },
  createdAt: '', updatedAt: ''
};

// Validate
const valResult = validateConfig(config, matrix);
console.log("Validation Result (warnings):", valResult.warnings);
console.log("Validation Result (errors):", valResult.errors);

// Execute without empty dim (since it's not referenced)
const assemResult = assemble(config, matrix);
console.log("Assemble Result:", assemResult.outputs[0]);
