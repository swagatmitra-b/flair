// LowDB database driver
// Debashish Buragohain
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
class LowWithLodash extends Low {
    chain = _.chain(this).get('data');
}
// specify the database file's location here
const adapter = new JSONFile(process.env.DB_FILE);
// starting with some default value which is an empty array of posts
export const db = new LowWithLodash(adapter, { posts: [] });
export const rw = async (code) => {
    await db.read();
    db.data ||= { posts: [] };
    const result = await code(db);
    await db.write();
    return result;
};
export const r = async (code) => {
    await db.read();
    db.data ||= { posts: [] };
    const result = await code(db);
    return result;
};
