import store from "./store.ts";
import { burnOptions, meltOptions } from "../lib/types.ts";
import { generateRandomHash, sanitizePythonPath } from "../lib/utils.ts";
import { spinner } from "../lib/utils.ts";
import { bruteFlairSearch } from "../lib/utils.ts";

class Flair {
  version: string;
  constructor() {
    this.version = "0.1.1-alpha";
  }
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
      store.setup();
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
        return new TextDecoder().decode(stdout);
      } else {
        console.log("error in successfully running python script:", stdout);
        Deno.exit(0);
      }
    } catch (error) {
      console.log("error in running python script");
      console.error(`Error: ${error}`);
      Deno.exit(0);
    }
  };

  burnWeights = async (
    { path, model, description }: burnOptions,
    combinedHash: string = ""
  ) => {
    try {
      let modulePath: string = "";
      let modelInstance: string = "";
      if (!path && !model) {
        const misc = store.getMisc();
        modulePath = misc.module_path;
        modelInstance = misc.model_instance;
      } else if (!path || !model) {
        console.log(
          "Both --path and --model values are required.\nTo reset the previously set values, use 'flair burn --set'. See --help for more information."
        );
        Deno.exit(0);
      } else if (path && model) {
        modulePath = sanitizePythonPath(path as string);
        modelInstance = model as string;
        store.saveMisc({ path: modulePath, model: modelInstance, set: true });
      }
      const hash = generateRandomHash();
      await bruteFlairSearch();
      const weightPath = ".flair/weights/" + hash + ".pth";
      const burnScript = await Deno.open("burn.py", {
        write: true,
        create: true,
      });
      const metricScript = await Deno.open("metrics.py", {
        write: true,
        create: true,
      });
      await burnScript.write(
        new TextEncoder().encode(
          `import torch\nfrom ${modulePath} import ${modelInstance}\nprint(f"\\nModel:{${modelInstance}}")\ndef save_model_weights(model):\n\ttorch.save(model.state_dict(),"${weightPath}")\nsave_model_weights(${modelInstance})`
        )
      );
      await metricScript.write(
        new TextEncoder().encode(
          `import torch.nn as nn\nfrom ${modulePath} import ${modelInstance}\nclass ModelCapture:\n\tdef __init__(self, model):\n\t\tself.model=model\n\tdef get_architecture(self):\n\t\tarchitecture=[]\n\t\tfor name, layer in self.model.named_modules():\n\t\t\tif not isinstance(layer,nn.Sequential) and name:\n\t\t\t\tlayer_info={"name":name,"type":layer.__class__.__name__,"num_params":sum(p.numel() for p in layer.parameters())}\n\t\t\t\tif isinstance(layer,(nn.Linear,nn.Conv2d,nn.Conv3d)):\n\t\t\t\t\tlayer_info.update({"in_features":getattr(layer,"in_features",None),"out_features":getattr(layer,"out_features",None),"kernel_size":getattr(layer,"kernel_size",None),"stride":getattr(layer,"stride",None),"padding":getattr(layer,"padding",None),"dilation":getattr(layer,"dilation",None)})\n\t\t\t\telif isinstance(layer,(nn.RNN,nn.LSTM,nn.GRU)):\n\t\t\t\t\tlayer_info.update({"input_size":layer.input_size,"hidden_size":layer.hidden_size,"num_layers":layer.num_layers,"bidirectional":layer.bidirectional})\n\t\t\t\telif isinstance(layer,nn.Transformer):\n\t\t\t\t\tlayer_info.update({"num_layers":layer.encoder.layers[0].self_attn.num_heads,"d_model":layer.d_model})\n\t\t\t\telif isinstance(layer,(nn.BatchNorm1d,nn.BatchNorm2d)):\n\t\t\t\t\tlayer_info.update({"num_features":layer.num_features,"eps":layer.eps,"momentum":layer.momentum})\n\t\t\t\tif "discriminator" in name.lower() or "generator" in name.lower():\n\t\t\t\t\tlayer_info["role"]="GAN Component"\n\t\t\t\tarchitecture.append(layer_info)\n\t\tprint(architecture)\nmeta=ModelCapture(${modelInstance})\nmeta.get_architecture()`
        )
      );
      burnScript.close();
      spinner.start("Serializing weights");
      await this.runPythonScript("burn.py", []);
      spinner.start("Capturing model metrics");
      const metrics = await this.runPythonScript("metrics.py", []);
      spinner.start("Generating hashes");
      await store.burnStore(description as string, hash, metrics, combinedHash);
      await Deno.remove("burn.py");
      await Deno.remove("metrics.py");
      spinner.stop();
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(0);
    }
  };
  melt = async ({ branch }: meltOptions) => {
    const [{ baseBranch, baseHash }, { meltBranch, meltHash }] =
      store.getLatestBurnHash(branch as string);
    const hash = generateRandomHash();
    await bruteFlairSearch();
    const meltScript = await Deno.open("melt.py", {
      write: true,
      create: true,
    });
    await meltScript.write(
      new TextEncoder().encode(
        `import torch\nweights1=torch.load(".flair/weights/${baseHash}.pth")\nweights2=torch.load(".flair/weights/${meltHash}.pth")\naveraged_weights={}\nfor key in weights1.keys():\n\tif key in weights2:\n\t\taveraged_weights[key]=(weights1[key]+weights2[key])/2\n\telse:\n\t\traise ValueError(f"Key '{key}' missing in one of the weights.")\ntorch.save(averaged_weights, ".flair/weights/${hash}.pth")`
      )
    );
    spinner.start(`Melting ${meltBranch} on ${baseBranch}`);
    await this.runPythonScript("melt.py", []);
    await Deno.remove("melt.py");
    await this.burnWeights(
      {
        description: `MELT: ${meltBranch} --> ${baseBranch}`,
      },
      meltHash + ";" + baseHash
    );
  };
}

const flair = new Flair();

export default flair;
