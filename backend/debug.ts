import { Matrix, Dimension, Step, PromptConfig } from './src/models/schema';
import { executeSteps } from './src/engine/resolver';
import { buildDependencyGraph, topologicalSort } from "./src/engine/dependency";
import { assemble } from './src/engine/assembler';

const dim1: Dimension = { id: 'd1', name: 'SubTopic', enabled: true, selectionMode: 'random', values: [{id:'v1', value:'Yoga'}] };
const dim2: Dimension = { id: 'd2', name: 'Tone', enabled: true, selectionMode: 'random', values: [{id:'v2', value:'Funny'}] };
const dim3: Dimension = { id: 'd3', name: 'Character', enabled: true, selectionMode: 'random', values: [{id:'v3', value:'Robot coach'}] };

const matrix: Matrix = { id: 'm1', name: 'M1', dimensions: [dim1, dim2, dim3], createdAt: '', updatedAt: '' };

const config: PromptConfig = {
  id: 'c1', name: 'C1', matrixId: 'm1', mode: 'single',
  steps: [
    { id: 's1', type: 'pick', dimensionRef: 'd1', label: 'Pick SubTopic', enabled: true, order: 0, template: '' },
    { id: 's2', type: 'pick', dimensionRef: 'd2', label: 'Pick Tone', enabled: true, order: 1, template: '' },
    { id: 's3', type: 'pick', dimensionRef: 'd3', label: 'Pick Character', enabled: true, order: 2, template: '' },
    { id: 's4', type: 'generative', label: 'Gen Text', enabled: true, order: 3, generativeInstruction: 'Write a max 15 word bold text line for a <Tone> poster about <SubTopic> featuring <Character>.', template: '' }
  ],
  outputSettings: { outputType: ['text'] },
  createdAt: '', updatedAt: ''
};

const result = executeSteps(config, matrix);
console.log("Resolved:", result.resolved);

const assemResult = assemble(config, matrix);
console.log("Assemble Result:", assemResult.outputs[0].prompt);
