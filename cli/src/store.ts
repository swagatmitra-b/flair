import { Database } from "@db/sqlite";
import { hashFile, spinner } from "../lib/utils.ts";

export const setup = () => {
  const db = new Database(".flair/test.db");

  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS branches (
          branch_id INTEGER PRIMARY KEY AUTOINCREMENT,
          branch_name TEXT UNIQUE NOT NULL,
          current BOOLEAN NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
  ).run();

  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS burns (
          burn_id INTEGER PRIMARY KEY AUTOINCREMENT,
          burn_hash TEXT UNIQUE NOT NULL,
          description TEXT,
          author TEXT DEFAULT SWAGAT, 
          parent_burn_id INTEGER,
          branch_id INTEGER NOT NULL,
          weights_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_burn_id) REFERENCES burns(burn_id),
          FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
          FOREIGN KEY (weights_id) REFERENCES weights(weights_id)
      );
    `
  ).run();

  // db.prepare(
  //   `
  //     CREATE TABLE IF NOT EXISTS metrics (
  //         metrics_id INTEGER PRIMARY KEY AUTOINCREMENT,
  //         commit_id INTEGER NOT NULL,
  //         accuracy REAL,
  //         loss REAL,
  //         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  //         FOREIGN KEY (commit_id) REFERENCES commits(commit_id)
  //     );
  //   `
  // ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS weights (
      weights_id INTEGER PRIMARY KEY AUTOINCREMENT,
      weights_hash TEXT NOT NULL,
      weights_file TEXT NOT NULL, 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `
  ).run();

  db.prepare(
    `
      INSERT INTO branches (branch_name) VALUES (?);
    `
  ).run("central");

  db.close();
};

export const getCurrentBranch = () => {
  const db = new Database(".flair/test.db");
  return db.sql`SELECT branch_id, branch_name from branches WHERE current = 1`[0];
};

export const createBranch = (name: string) => {
  const db = new Database(".flair/test.db");

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
};

export const getAllBranches = () => {
  const db = new Database(".flair/test.db");

  const branches = db.sql`SELECT branch_name from branches`;
  return branches.map((branch) => branch.branch_name);
};

export const hopBranch = (branch: string) => {
  const db = new Database(".flair/test.db");

  db.exec(`UPDATE branches
           SET current = 0
           WHERE current = 1;
  `);

  db.prepare(
    `UPDATE branches
           SET current = 1
           WHERE branch_name = ?;
  `
  ).run(branch);

  // TODO: Error for non-existing branch
};

const getWeightSNO = () => {
  const db = new Database(".flair/test.db");
  const { weight_id } = db.sql`SELECT COUNT(*) as weight_id FROM weights`[0];
  return weight_id + 1;
};

export const burnDB = async (description: string, burnHash: string) => {
  const db = new Database(".flair/test.db");

  const { branch_id } =
    db.sql`SELECT branch_id from branches WHERE current = 1`[0];

  const burnIdQuery =
    db.sql`SELECT burn_id from burns ORDER BY burn_id DESC LIMIT 1`[0];
  const parentBurnId = burnIdQuery ? burnIdQuery.burn_id : null;

  const weightSNO = getWeightSNO();
  const weightHash = await hashFile(burnHash);

  spinner.stop();
  spinner.start("Burning to timeline");

  db.prepare(
    `
      INSERT INTO weights (weights_hash, weights_file) VALUES (?, ?);
    `
  ).run(weightHash, `./flair/weights/${burnHash}.pth`);

  db.prepare(
    `
      INSERT INTO burns (burn_hash, description, parent_burn_id, branch_id, weights_id) VALUES (?, ?, ?, ?, ?);
    `
  ).run(burnHash, description, parentBurnId, branch_id, weightSNO);
};

export const getAllBurns = () => {
  const db = new Database(".flair/test.db");
  const { branch_id } = getCurrentBranch();
  return db.sql`SELECT burn_hash, description, author, branch_id, created_at from burns WHERE branch_id = ${branch_id}`;
};
