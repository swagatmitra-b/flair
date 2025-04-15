// LowDB database driver
// Debashish Buragohain

import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { Post } from '../../models/post';

export type Identifiable = {
  id: string;
};

export type UserTied = {
  userId: string;
};

export type UserIdentifiablePost = Post & Identifiable & UserTied;

export type Data = {
  posts: UserIdentifiablePost[];
};

class LowWithLodash<T> extends Low<T> {
  chain: _.ExpChain<this['data']> = _.chain(this).get('data');
}

// specify the database file's location here
const adapter = new JSONFile<Data>(process.env.DB_FILE!);
// starting with some default value which is an empty array of posts
export const db = new LowWithLodash(adapter, { posts: [] });

export const rw = async <T>(
  code: (db: LowWithLodash<Data>) => T | Promise<T>,
): Promise<T> => {
  await db.read();
  db.data ||= { posts: [] };
  const result = await code(db);
  await db.write();
  return result;
};

export const r = async <T>(
  code: (db: LowWithLodash<Data>) => T | Promise<T>,
): Promise<T> => {
  await db.read();
  db.data ||= { posts: [] };
  const result = await code(db);
  return result;
};
