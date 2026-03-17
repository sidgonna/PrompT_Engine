const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function seed() {
  try {
    // ----------------------------------------------------
    // CASE 1: Food
    // ----------------------------------------------------
    console.log("Creating Matrix: Food...");
    const matrix1 = await request('POST', '/api/matrices', { name: "Food App Case" });
    const m1Id = matrix1.data.id;
    
    const leafDim = await request('POST', `/api/matrices/${m1Id}/dimensions`, {
      name: "Leafy Green", selectionMode: "random", values: [{value: "Spinach"}, {value: "Kale"}, {value: "Swiss chard"}]
    });
    const toneDim = await request('POST', `/api/matrices/${m1Id}/dimensions`, {
      name: "Tone", selectionMode: "random", values: [{value: "Motivational"}, {value: "Scientific"}, {value: "Empowering"}]
    });
    const angleDim = await request('POST', `/api/matrices/${m1Id}/dimensions`, {
      name: "Angle", selectionMode: "random", values: [{value: "Nutritional Profile"}, {value: "Key Health Benefits"}, {value: "Myth vs. fact"}]
    });

    const c1Res = await request('POST', '/api/configs', {
      name: "Food Batch Strategy",
      matrixId: m1Id,
      mode: "batch",
      steps: [
        { id: "s1", type: "pick", dimensionRef: leafDim.data.id, label: "Pick Leafy Green", enabled: true, order: 0, template: "" },
        { id: "s2", type: "pick", dimensionRef: toneDim.data.id, label: "Pick Tone", enabled: true, order: 1, template: "" },
        { id: "s3", type: "pick", dimensionRef: angleDim.data.id, label: "Pick Angle", enabled: true, order: 2, template: "" },
        { id: "s4", type: "generative", label: "Final Prompt", enabled: true, order: 3, generativeInstruction: "Write content about <Leafy Green> in a <Tone> tone focusing on <Angle>. Make it a mini-paragraph 100-150 words.", template: "" }
      ],
      batchSettings: { totalCount: 3 },
      outputSettings: { outputType: ["text"], format: "horizontal" }
    });

    // ----------------------------------------------------
    // CASE 2: Exercise
    // ----------------------------------------------------
    console.log("Creating Matrix: Exercise...");
    const matrix2 = await request('POST', '/api/matrices', { name: "Exercise Visual Case" });
    const m2Id = matrix2.data.id;
    
    const topicDim = await request('POST', `/api/matrices/${m2Id}/dimensions`, {
      name: "Subtopic", selectionMode: "random", values: [{value: "Yoga"}, {value: "Strength training"}, {value: "Cardio"}]
    });
    const typeDim = await request('POST', `/api/matrices/${m2Id}/dimensions`, {
      name: "Prompt Type", selectionMode: "random", values: [{value: "Daily Exercise Challenge"}, {value: "Mirror Talk Poster"}, {value: "Before & After"}]
    });
    const tone2Dim = await request('POST', `/api/matrices/${m2Id}/dimensions`, {
      name: "Tone", selectionMode: "random", values: [{value: "Encouraging"}, {value: "Motivational"}, {value: "Scientific"}]
    });
    const charDim = await request('POST', `/api/matrices/${m2Id}/dimensions`, {
      name: "Character", selectionMode: "random", values: [{value: "Sloth"}, {value: "Robot coach"}, {value: "Gym newbie"}]
    });
    const layoutDim = await request('POST', `/api/matrices/${m2Id}/dimensions`, {
      name: "Layout", selectionMode: "random", values: [{value: "1-sided Poster"}, {value: "Mirror Layout"}, {value: "Progress Tracker"}]
    });

    const c2Res = await request('POST', '/api/configs', {
      name: "Exercise Visual Strategy",
      matrixId: m2Id,
      mode: "batch",
      steps: [
        { id: "x1", type: "pick", dimensionRef: topicDim.data.id, label: "Pick Subtopic", enabled: true, order: 0, template: "" },
        { id: "x2", type: "pick", dimensionRef: typeDim.data.id, label: "Pick Prompt Type", enabled: true, order: 1, template: "" },
        { id: "x3", type: "pick", dimensionRef: tone2Dim.data.id, label: "Pick Tone", enabled: true, order: 2, template: "" },
        { id: "x4", type: "pick", dimensionRef: charDim.data.id, label: "Pick Character", enabled: true, order: 3, template: "" },
        { id: "x5", type: "pick", dimensionRef: layoutDim.data.id, label: "Pick Layout", enabled: true, order: 4, template: "" },
        { id: "x6", type: "generative", label: "Gen Text", enabled: true, order: 5, generativeInstruction: "Write a max 15 word line for a <Tone> <Prompt Type> about <Subtopic> featuring <Character> formatted as <Layout>.", template: "" },
        { id: "x7", type: "generative", label: "Gen Scene", enabled: true, order: 6, generativeInstruction: "Describe a visual scene matching <Layout> featuring <Character> doing <Subtopic>.", template: "" },
        { id: "x8", type: "ref", stepRefs: ["x6", "x7"], label: "Final Output", enabled: true, order: 7, template: "Text to Embed: {step_x6}\n\nVisual Scene: {step_x7}" }
      ],
      batchSettings: { totalCount: 2 },
      outputSettings: { outputType: ["image_with_content"], format: "vertical" }
    });

    console.log("Successfully seeded database with test cases!");
  } catch(e) {
    console.error(e);
  }
}

seed();
