import { Database } from "@db/sqlite";
import { hashFile, spinner } from "../lib/utils.ts";
import * as tables from "../lib/schema.ts";
import { setOptions } from "../lib/types.ts";

class Store {
  path: string;
  constructor() {
    this.path = ".flair/store.db";
  }
  setup() {
    const db = new Database(this.path);

    for (const [_, table] of Object.entries(tables)) {
      db.prepare(table).run();
    }

    db.prepare(
      `
      INSERT INTO branches (branch_name) VALUES (?);
    `
    ).run("central");

    db.close();
  }

  getCurrentBranch() {
    const db = new Database(this.path);
    return db.sql`SELECT branch_id, branch_name from branches WHERE current = 1`[0];
  }

  createBranch(name: string) {
    const db = new Database(this.path);

    db.exec(`UPDATE branches
           SET current = 0
           WHERE current = 1;
  `);

    db.prepare(
      `
      INSERT INTO branches (branch_name) VALUES (?);
    `
    ).run(name);

    db.close();
  }

  getAllBranches() {
    const db = new Database(this.path);
    const branches = db.sql`SELECT branch_name from branches`;
    return branches.map((branch) => branch.branch_name);
  }

  hopBranch(branch: string) {
    const db = new Database(this.path);

    db.exec(`UPDATE branches
             SET current = 0
             WHERE current = 1;
          `);

    const a = db
      .prepare(
        `UPDATE branches
         SET current = 1
         WHERE branch_name = ?;
        `
      )
      .run(branch);

    if (!a) {
      console.log(
        `Branch ${branch} does not exist. Use "flair branch -l" to list all available branches.`
      );
      Deno.exit(0);
    }

    db.close();
  }

  getWeightSNO() {
    const db = new Database(this.path);
    const { weight_id } = db.sql`SELECT COUNT(*) as weight_id FROM weights`[0];
    return weight_id + 1;
  }

  async burnStore(
    description: string,
    burnHash: string,
    metrics: string,
    combinedHash: string
  ) {
    const db = new Database(this.path);
    let parentBurnHash = "";

    const { branch_id } =
      db.sql`SELECT branch_id from branches WHERE current = 1`[0];

    if (combinedHash) {
      parentBurnHash = combinedHash;
    } else {
      const burnIdQuery =
        db.sql`SELECT burn_hash from burns ORDER BY burn_id DESC LIMIT 1`[0];
      parentBurnHash = burnIdQuery ? burnIdQuery.burn_hash : null;
    }

    const weightSNO = await this.getWeightSNO();
    const weightHash = await hashFile(burnHash);

    spinner.stop();
    spinner.start("Burning to timeline");

    db.prepare(
      `
      INSERT INTO weights (weights_hash, weights_file) VALUES (?, ?);
    `
    ).run(weightHash, `.flair/weights/${burnHash}.pth`);

    db.prepare(
      `
      INSERT INTO burns (burn_hash, description, parent_burn_hash, branch_id, weights_id) VALUES (?, ?, ?, ?, ?);
    `
    ).run(burnHash, description, parentBurnHash, branch_id, weightSNO);

    db.prepare(
      `
      INSERT INTO metrics (burn_hash, architecture) VALUES (?, ?);
    `
    ).run(burnHash, metrics);
  }

  getLatestBurnHash(branch: string) {
    const db = new Database(this.path);

    const current = this.getCurrentBranch();
    if (branch == current.branch_name) {
      console.log("Cannot melt on the same branch");
      console.log("Current: " + branch);
      Deno.exit(0);
    }

    const meltBranch =
      db.sql`SELECT branch_id from branches WHERE branch_name = ${branch}`[0];
    if (!meltBranch) {
      console.log(
        `Branch ${branch} does not exist. Use "flair branch -l" to list all available branches.`
      );
      Deno.exit(0);
    }
    const meltBurnHash =
      db.sql`SELECT burn_hash from burns WHERE branch_id = ${meltBranch.branch_id} ORDER BY burn_id DESC LIMIT 1`[0];

    if (!meltBurnHash) {
      console.log(`There are no burns on branch ${branch}.`);
      Deno.exit(0);
    }

    const baseBurnHash =
      db.sql`SELECT burn_hash from burns WHERE branch_id = ${current.branch_id} ORDER BY burn_id DESC LIMIT 1`[0];

    if (!baseBurnHash) {
      console.log(`There are no burns on the current branch.`);
      console.log(`Current: ${current.branch_name}`);
      Deno.exit(0);
    }

    return [
      { baseBranch: current.branch_name, baseHash: baseBurnHash.burn_hash },
      { meltBranch: branch, meltHash: meltBurnHash.burn_hash },
    ];
  }

  getAllBurns() {
    const db = new Database(this.path);
    const { branch_id } = this.getCurrentBranch();
    return db.sql`SELECT burn_hash, description, author, branch_id, parent_burn_hash, created_at from burns WHERE branch_id = ${branch_id}`;
  }

  saveMisc(args: setOptions) {
    const db = new Database(this.path);

    const { is_present } = db.sql`SELECT COUNT(*) as is_present FROM misc`[0];

    if (is_present) {
      db.prepare(
        `
        UPDATE misc
        SET module_path = ?
        WHERE id = 1
        `
      ).run(args.path);

      db.prepare(
        `
        UPDATE misc
        SET model_instance = ?
        WHERE id = 1
        `
      ).run(args.model);
    } else {
      db.prepare(
        `
      INSERT INTO misc (module_path, model_instance) VALUES (?, ?);
        `
      ).run(args.path, args.model);
    }
  }
  getMisc() {
    const db = new Database(this.path);
    const misc = db.sql`SELECT module_path, model_instance FROM misc`[0];
    if (!misc) {
      console.log(
        "Values of --path and --model are not set. See 'flair burn --help' for more information."
      );
      Deno.exit(0);
    }
    return misc;
  }

  checkSignIn() {
    const db = new Database(this.path);
    const cred = db.sql`SELECT id FROM creds`[0];
    if (cred) return false;
    return true;
  }

  walletSignIn(token: string, wallet: string) {
    const db = new Database(this.path);
    db.prepare(
      `
      INSERT INTO creds (token, wallet) VALUES (?, ?);
        `
    ).run(token, wallet);
  }

  walletSignOut() {
    const db = new Database(this.path);
    db.prepare(
      `
      DELETE FROM creds WHERE id = 1;
      `
    ).run();
    console.log("Successfully signed out of Flair");
  }
}

const store = new Store();

export default store;
