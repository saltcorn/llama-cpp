const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const { div } = require("@saltcorn/markup/tags");
const Handlebars = require("handlebars");

const util = require("util");
const path = require("path");
const os = require("os");
const fs = require("fs");

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
          const int_field_options = table.fields.filter(
            (f) => f.type?.name === "Integer"
          );

          const models = fs.readdirSync(path.join(llama_dir, "models"));
          return new Form({
            fields: [
              {
                label: "Prompt template",
                name: "prompt_template",
                type: "String",
                fieldview: "textarea",
                sublabel: div(
                  "Use handlebars to access fields. Example: <code>My name is {{name}}. How are you?</code>. Variables in scope: " +
                    table.fields.map((f) => `<code>${f.name}</code>`).join(", ")
                ),
              },
              {
                label: "Num. tokens field",
                name: "ntokens_field",
                type: "String",
                attributes: { options: int_field_options.map((f) => f.name) },
                sublabel:
                  "Override number of tokens set in instance parameters with value in this field, if chosen",
              },
              {
                label: "Model",
                name: "model",
                type: "String",
                required: true,
                attributes: { options: models },
              },
            ],
          });
        },
      },
    ],
  });

const llama_dir =
  process.env.LLAMA_CPP_DIR || path.join(os.homedir(), "llama.cpp");

module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "llama-cpp",

  modelpatterns: {
    Llama: {
      prediction_outputs: ({ configuration }) => [
        { name: "output", type: "String" },
        { name: "prompt", type: "String" },
      ],
      hyperparameter_fields: ({ table, configuration }) => [
        {
          name: "ntokens",
          label: "Num tokens",
          type: "Integer",
          attributes: { min: 1 },
          required: true,
          default: 128,
          sublabel: "Can be overridden by number of tokens field, if set",
        },
        {
          name: "temp",
          label: "Temperature",
          type: "Float",
          attributes: { min: 0 },
          default: 0.8,
        },
        {
          name: "repeat_penalty",
          label: "Repeat penalty",
          type: "Float",
          attributes: { min: 0 },
          default: 1.1,
        },
      ],
      configuration_workflow,
      predict: async ({
        id, //instance id
        model: {
          configuration: { prompt_template, ntokens_field, model },
          table_id,
        },
        hyperparameters,
        fit_object,
        rows,
      }) => {
        const results = [];
        const template = Handlebars.compile(prompt_template || "");

        let hyperStr = "";
        if (hyperparameters.temp) hyperStr += ` --temp ${hyperparameters.temp}`;
        if (hyperparameters.repeat_penalty)
          hyperStr += ` --repeat-penalty ${hyperparameters.repeat_penalty}`;

        for (const row of rows) {
          const prompt = template(row);
          let nstr = "";
          if (ntokens_field && row[ntokens_field])
            nstr = `-n ${row[ntokens_field]}`;
          else if (hyperparameters.ntokens)
            nstr = `-n ${hyperparameters.ntokens}`;

          console.log("running llama with prompt: ", prompt);
          const { stdout, stderr } = await exec(
            `./main -m ./models/${model} -p "${prompt}" ${nstr}${hyperStr}`,
            { cwd: llama_dir }
          );
          console.log("llama result", stderr, stdout);
          results.push({ output: stdout, prompt });
        }
        return results;
      },
    },
  },
};
