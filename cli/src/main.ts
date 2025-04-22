#!/usr/bin/env -S deno run --allow-run

import { Command } from "@cliffy/command";
import {
  createBranch,
  getAllBranches,
  getAllBurns,
  getCurrentBranch,
  hopBranch,
} from "./store.ts";
import { burnOptions } from "../lib/types.ts";
import flair from "./function.ts";

const program = new Command();

program
  .command(
    "flair",
    new Command()
      .command("up")
      .action(() => flair.initialize())
      .command("branch")
      .option("-l, --list", "list all available branches", {
        standalone: true,
        action: () => {
          for (const branch of getAllBranches()) {
            const { branch_name } = getCurrentBranch();
            if (branch_name == branch) {
              console.log(branch + " <--");
            } else console.log(branch);
          }
        },
      })
      .action(() => {
        const { branch_name } = getCurrentBranch();
        console.log(`current: ${branch_name}`);
      })
      .command("create")
      .arguments("<name>")
      .action((_: void, branch: string) => {
        createBranch(branch);
        console.log("new branch created");
        const { branch_name } = getCurrentBranch();
        console.log(`current: ${branch_name}`);
      })
      .command("hop")
      .arguments("<name>")
      .action((_: void, branch: string) => {
        hopBranch(branch);
        const { branch_name } = getCurrentBranch();
        console.log(`current: ${branch_name}`);
      })
      .command("burn", "")
      .option("-f, --file [type:string]", "Filename containing model", {
        required: true,
      })
      .option("-m, --model [type:string]", "Name of model instance", {
        required: true,
      })
      .option("-d, --description [type:string]", "Description", {
        required: true,
      })
      .group("The required flags to pass while burning")
      .action((options: burnOptions, _: void) => flair.burnWeights(options))
      .command("timeline", "")
      .action(() => {
        const burns = getAllBurns().reverse();
        console.log(
          `\nBurn Timeline on branch: ${getCurrentBranch().branch_name}\n`
        );
        for (let i = 0; i < burns.length; i++) {
          console.log(
            `${burns[i].burn_hash} -- ${burns[i].author} -- ${burns[i].created_at}\n ${burns[i].description}` +
              `${i < burns.length - 1 ? "\n\n^\n|\n" : ""}`
          );
        }
      })
      // .command("load", "Load weight file to model")
      // .arguments("<weight_hash> ")
      // .option("-f, --file [type:string]", "Filename containing model", {
      //   required: true,
      // })
      // .option("-m, --model [type:string]", "Name of model instance", {
      //   required: true,
      // })
      // .option("-w, --weightHash [type:string]", "Weight Hash", {
      //   required: true,
      // })
      // .action((options: loadOptions, _:void) => flair.loadWeights(options))
      .command("rollback")
      .action(() => {})
      .command("fetch")
      .action(() => {})
  )
  .global()
  .action(() => console.log("The version control for Federity."))
  .parse(Deno.args);
