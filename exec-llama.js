const util = require("util");
const exec = util.promisify(require("child_process").exec);

const f = async () => {
  const { stdout } = await exec(
    `./main -m ./models/llama-2-7b-chat.ggmlv3.q4_K_M.bin -p "Building a website can be done in 10 simple steps:" -n 16 -t 4`,
    { cwd: "/Users/tomn/llama.cpp" }
  );
  console.log(stdout);
};

f();
