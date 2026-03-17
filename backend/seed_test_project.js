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
    console.log("Creating Matrix...");
    const matrixRes = await request('POST', '/api/matrices', { name: "Exercise App Test" });
    const matrixId = matrixRes.data.id;
    console.log("Matrix ID:", matrixId);
    
    console.log("Creating Dimensions...");
    const subTopicDimRes = await request('POST', `/api/matrices/${matrixId}/dimensions`, {
      name: "SubTopic",
      selectionMode: "random",
      values: [{value: "Yoga"}, {value: "Cardio"}, {value: "Strength training"}]
    });
    
    const toneDimRes = await request('POST', `/api/matrices/${matrixId}/dimensions`, {
      name: "Tone",
      selectionMode: "random",
      values: [{value: "Motivational"}, {value: "Funny"}, {value: "Scientific"}]
    });
    
    const characterDimRes = await request('POST', `/api/matrices/${matrixId}/dimensions`, {
      name: "Character",
      selectionMode: "random",
      values: [{value: "Sloth meditating"}, {value: "Robot coach"}, {value: "Broccoli doing yoga"}]
    });
    
    console.log("Creating Config...");
    const subTopicDimId = subTopicDimRes.data.id;
    const toneDimId = toneDimRes.data.id;
    const charDimId = characterDimRes.data.id;

    const configRes = await request('POST', '/api/configs', {
      name: "Exercise Generator",
      matrixId: matrixId,
      mode: "batch",
      steps: [
        {
          id: "step1",
          type: "pick",
          dimensionRef: subTopicDimId,
          label: "Pick SubTopic",
          enabled: true,
          order: 0,
          template: ""
        },
        {
          id: "step2",
          type: "pick",
          dimensionRef: toneDimId,
          label: "Pick Tone",
          enabled: true,
          order: 1,
          template: ""
        },
        {
          id: "step3",
          type: "pick",
          dimensionRef: charDimId,
          label: "Pick Character",
          enabled: true,
          order: 2,
          template: ""
        },
        {
          id: "step4",
          type: "generative",
          label: "Gen Text Line",
          enabled: true,
          order: 3,
          generativeInstruction: "Write a max 15 word bold text line for a <Tone> poster about <SubTopic> featuring <Character>.",
          template: ""
        },
        {
          id: "step5",
          type: "generative",
          label: "Gen Scene",
          enabled: true,
          order: 4,
          generativeInstruction: "Describe a simple visual scene for an image featuring <Character> in a gym or park, with pastel color scheme.",
          template: ""
        },
        {
          id: "step6",
          type: "ref",
          stepRefs: ["step4", "step5"],
          label: "Final Assemble",
          enabled: true,
          order: 5,
          template: "Text to embed: {step_step4}\n\nScene details: {step_step5}\n\nMake sure to feature a <Tone> vibe."
        }
      ],
      batchSettings: {
        totalCount: 3
      },
      outputSettings: {
        outputType: ["image_with_content"],
        format: "vertical"
      }
    });

    console.log("Successfully seeded database!");
  } catch(e) {
    console.error(e);
  }
}

seed();
