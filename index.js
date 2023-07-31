const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const { div } = require("@saltcorn/markup/tags");
const Handlebars = require("handlebars");

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
                label: "Prompt template",
                name: "prompt_template",
                type: "String",
                fieldview: "textarea",
                sublabel: div(
                  "Use handlebars to access fields. Example: <code>&lt;h1&gt;{{name}}&lt;/h1&gt;</code>. Variables in scope: " +
                    table.fields.map((f) => `<code>${f.name}</code>`).join(", ")
                ),
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
        { name: "output", type: "String" },
        { name: "prompt", type: "String" },
      ],
      configuration_workflow,
      predict: async ({
        id, //instance id
        model: {
          configuration: { prompt_template },
          table_id,
        },
        hyperparameters,
        fit_object,
        rows,
      }) => {
        const results = [];
        const template = Handlebars.compile(prompt_template || "");

        for (const row of rows) {
          const prompt = template(row);
          console.log("running llama with prompt: ", prompt);
          const { stdout } = await exec(
            `./main -m ./models/llama-2-7b-chat.ggmlv3.q4_K_M.bin -p "${prompt}" -n 16 -t 4`,
            { cwd: "/Users/tomn/llama.cpp" }
          );
          console.log("llama result", stdout);
          results.push({ output: stdout, prompt });
        }
        return results;
      },
    },
  },
};

/* todo

hyperparameters
set ntokens

*/
