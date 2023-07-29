const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: "Predictors",
        form: async (context) => {
          const table = await Table.findOne(
            context.table_id
              ? { id: context.table_id }
              : { name: context.exttable_name }
          );
          //console.log(context);
          const field_options = table.fields.filter(
            (f) => f.type?.name === "String"
          );
          return new Form({
            fields: [
              {
                label: "Prompt",
                name: "prompt",
                type: "String",
                fieldview: "textarea",
              },
              {
                name: "response_field",
                label: "Response field",
                subfield: "The variable that is to be filled with response",
                type: "String",
                attributes: {
                  options: field_options,
                },
              },
            ],
          });
        },
      },
    ],
  });

let llama;
module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "llama-cpp",
  onLoad: async () => {
    const { LLM } = await import("llama-node");
    const { LLamaCpp } = await import("llama-node/dist/llm/llama-cpp.js");
    llama = new LLM(LLamaCpp);
    const config = {
      modelPath: "/Users/tomn/llama.cpp/models/llama-2-7b.ggmlv3.q4_0.bin",
      enableLogging: true,
      nCtx: 1024,
      seed: 0,
      f16Kv: false,
      logitsAll: false,
      vocabOnly: false,
      useMlock: false,
      embedding: false,
      useMmap: true,
      nGpuLayers: 0,
    };
    await llama.load(config);
  },
  modeltemplates: {
    Llama: {
      prediction_outputs: ({ configuration }) => [
        { name: configuration.outcome_field, type: "String" },
      ],
      configuration_workflow,
      predict: async ({
        id, //instance id
        model: {
          configuration: { prompt, outcome_field },
          table_id,
        },
        hyperparameters,
        fit_object,
        rows,
      }) => {
        const results = [];
        for (const row of rows) {
          const tokens = [];
          await llama.createCompletion(
            {
              nThreads: 4,
              nTokPredict: 16,
              topK: 40,
              topP: 0.1,
              temp: 0.2,
              repeatPenalty: 1,
              prompt,
            },
            (response) => {
              console.log(response);
              tokens.push(response.token);
            }
          );
          results.push({ [outcome_field]: tokens.join("") });
        }
        return results;
      },
    },
  },
};
