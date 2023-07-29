const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

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

module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "llama-cpp",

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
          const { stdout } = await exec(
            `./main -m ./models/llama-2-7b-chat.ggmlv3.q4_K_M.bin -p "${prompt}" -n 16 -t 4`,
            { cwd: "/Users/tomn/llama.cpp" }
          );
          results.push({ [outcome_field]: stdout });
        }
        return results;
      },
    },
  },
};
