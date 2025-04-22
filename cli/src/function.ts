import { setup, burnDB } from "./store.ts";
import { burnOptions } from "../lib/types.ts";
import { generateRandomHash } from "../lib/utils.ts";
import { spinner } from "../lib/utils.ts";

class Flair {
  constructor() {}
  initialize = async () => {
    try {
      const exists = await Deno.stat("./.flair");
      if (exists.isDirectory) {
        console.log("You have already flaired up");
        Deno.exit(0);
      }
    } catch (_) {
      //
    }
    try {
      await Deno.mkdir(".flair/weights", { recursive: true });
      setup();
    } catch (error) {
      console.log(error);
    }
  };
  runPythonScript = async (script: string, args: string[]) => {
    try {
      const process = new Deno.Command("python", {
        args: [script, ...args],
      });
      const { success, stdout } = await process.output();

      if (success) {
        spinner.stop();
        console.log(new TextDecoder().decode(stdout));
      } else {
        console.log("error:", stdout);
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  };
  burnWeights = async ({ file, model, description }: burnOptions) => {
    try {
      const hash = generateRandomHash();
      const script = await Deno.open("burn.py", { write: true, create: true });
      await script.write(
        new TextEncoder().encode(
          `import importlib\nimport sys\nimport torch\nargs = sys.argv[1:]\nmodule = importlib.import_module(args[0])\nmodel = getattr(module, args[1])\nprint(f"\\nModel: {model}")\ndef save_model_weights(model):\n\ttorch.save(model.state_dict(), ".flair/weights/${hash}.pth")\nsave_model_weights(model)`
        )
      );
      if (Deno.build.os == "linux") {
        await Deno.chmod("burn.py", 0o444);
      }
      script.close();
      spinner.start("Serializing weights");
      await this.runPythonScript("burn.py", [file, model] as string[]);
      spinner.start("Generating hashes");
      await burnDB(description as string, hash);
      await Deno.remove("burn.py");
      spinner.stop();
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  };
  // loadWeights = async ({ file, model, weightHash }: loadOptions) => {
  //   try {
  //     const script = await Deno.open("load.py", { write: true, create: true });
  //     await script.write(
  //       new TextEncoder().encode(
  //         `import importlib\nimport sys\nimport torch\nargs=sys.argv[1:]\nmodule=importlib.import_module(args[0])\nmodel=getattr(module,args[1])\ndef load_model_weights(model):\n\tmodel.load_state_dict(torch.load(".flair/weights/${weightHash}.pth"))\n\tfor name, param in model.named_parameters():\n\t\tprint(f"{name} - Shape: {param.shape}")\n\t\tprint(param.data)\nload_model_weights(model)`
  //       )
  //     );
  //     if (Deno.build.os == "linux") {
  //       await Deno.chmod("load.py", 0o444);
  //     }
  //     script.close();
  //     await this.runPythonScript("load.py", [file, model] as string[]);
  //     await Deno.remove("load.py");
  //   } catch (error) {
  //     console.error(`Error: ${error}`);
  //   }
  // };
}

const flair = new Flair();

export default flair;
