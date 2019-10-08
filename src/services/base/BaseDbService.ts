import { BaseComponentContext } from "@microsoft/sp-component-base";
import { Text } from "@microsoft/sp-core-library";
import { assign } from "@microsoft/sp-lodash-subset";
import { DB, openDb, ObjectStore } from "idb";
import { IBaseItem } from "../../interfaces/IBaseItem";
import { IDataService } from "../../interfaces/IDataService";
import { SPFile } from "../../models/index";
import { UtilsService } from "../index";
import { BaseService } from "./BaseService";
import { IAddOrUpdateResult } from "../../interfaces";


/**
 * Base classe for indexedDB interraction using SP repository
 */
export class BaseDbService<T extends IBaseItem> extends BaseService implements IDataService<T> {
    protected tableName: string;
    protected db: DB;
    protected itemType: (new (item?: any) => T);

    /**
     * 
     * @param tableName : Name of the db table the service interracts with
     */
    constructor(type: (new (item?: any) => T), tableName: string) {
        super();
        this.tableName = tableName;
        this.db = null;
        this.itemType = type;
    }

    protected async getAllKeysInternal<TKey extends string | number>(store: ObjectStore<T, TKey>): Promise<Array<TKey>> {
        let result: Array<TKey> = [];
        if (store.getAllKeys) {
            result = await store.getAllKeys();
        }
        else {
            let cursor = await store.openCursor();
            while (cursor) {
                result.push(cursor.primaryKey);
                cursor = await cursor.continue();
            }
        }
        return result;
    }

    protected async getNextAvailableKey(): Promise<number> {
        let result: number;
        await this.OpenDb();
        const tx = this.db.transaction(this.tableName, 'readonly');
        const store = tx.objectStore<T, number>(this.tableName);
        const keys = await this.getAllKeysInternal(store);
        if (keys.length > 0) {
            const minKey = Math.min(...keys);
            result = Math.min(-2, minKey - 1);
        }
        else {
            result = -2;
        }
        await tx.complete;
        return result;
    }

    /**
     * Opens indexed db, update structure if needed
     */
    protected async OpenDb(): Promise<void> {
        if (this.db == null) {
            if (!('indexedDB' in window)) {
                throw new Error(BaseService.Configuration.translations.IndexedDBNotDefined);
            }
            const dbName = Text.format(BaseService.Configuration.DbName, BaseService.Configuration.context.pageContext.web.serverRelativeUrl);
            this.db = await openDb(dbName, BaseService.Configuration.Version, (UpgradeDB) => {
                // add new tables
                for (const tableName in BaseService.Configuration.tableNames) {
                    if (!UpgradeDB.objectStoreNames.contains(tableName)) {
                        UpgradeDB.createObjectStore(tableName, { keyPath: 'id', autoIncrement: tableName == "Transaction" });
                    }
                }
                // TODO : remove old tables
            });
        }
    }

    /**
     * Add or update an item in DB and returns updated item
     * @param item Item to add or update
     */
    public async addOrUpdateItem(item: T): Promise<IAddOrUpdateResult<T>> {
        await this.OpenDb();
        const nextid = await this.getNextAvailableKey();
        const tx = this.db.transaction(this.tableName, 'readwrite');
        const store = tx.objectStore(this.tableName);
        try {
            if (typeof (item.id) === "number" && !store.autoIncrement && item.id === -1) {
                item.id = nextid;
            }
            if (item instanceof SPFile && item.content && item.content.byteLength >= 10485760) {
                // remove existing chunks
                let keys: string[] = await this.getAllKeysInternal(store);
                let chunkkeys = keys.filter((k) => {
                    const test = k.match(/^.*_chunk_\d+$/g);
                    return test != null && test.length > 0;
                });
                await Promise.all(chunkkeys.map((ck) => {
                    return store.delete(ck);
                }));
                // add chunked file
                let idx = 0;
                let size = 0;
                while (size < item.content.byteLength) {
                    const firstidx = idx * 10485760;
                    const lastidx = Math.min(item.content.byteLength, firstidx + 10485760);
                    let chunk = item.content.slice(firstidx, lastidx);
                    // create file object
                    let chunkitem = new SPFile();
                    chunkitem.serverRelativeUrl = item.serverRelativeUrl + (idx === 0 ? "" : "_chunk_" + idx);
                    chunkitem.name = item.name;
                    chunkitem.mimeType = item.mimeType;
                    chunkitem.content = chunk;
                    await store.put(assign({}, chunkitem));
                    idx++;
                    size += chunk.byteLength;
                }

            }
            else {
                await store.put(assign({}, item)); // store simple object with data only 
            }
            await tx.complete;

        } catch (error) {
            console.error(error.message + " - " + error.Name);
            tx.abort();
        }
        return {
            item: item
        };
    }

    public async deleteItem(item: T): Promise<void> {
        await this.OpenDb();
        const tx = this.db.transaction(this.tableName, 'readwrite');
        const store = tx.objectStore(this.tableName);
        try {
            if (item instanceof SPFile) {
                let keys: string[] = await this.getAllKeysInternal(store);
                let chunkkeys = keys.filter((k) => {
                    const test = k.match(/^.*_chunk_\d+$/g);
                    return test != null && test.length > 0;
                });
                await Promise.all(chunkkeys.map((ck) => {
                    return store.delete(ck);
                }));
            }
            await store.delete(item.id); // store simple object with data only             
            await tx.complete;
        } catch (error) {
            console.error(error.message + " - " + error.Name);
            tx.abort();
        }
    }


    public async get(query?: string): Promise<Array<T>> {
        let results = new Array<T>();
        let hash = super.hashCode(query);
        let items = await this.getAll();

        for (let item of items) {
            if (item.queries && item.queries.indexOf(hash) >= 0) {
                results.push(item);
            }
        }
        return results;
    }


    /**
     * add items in table (ids updated)
     * @param newItems 
     */
    public async addOrUpdateItems(newItems: Array<T>, query?: string): Promise<Array<T>> {
        await this.OpenDb();
        let nextid = await this.getNextAvailableKey();
        const tx = this.db.transaction(this.tableName, 'readwrite');
        const store = tx.objectStore(this.tableName);
        try {
            await Promise.all(newItems.map(async (item) => {
                if (typeof (item.id) === "number" && !store.autoIncrement && item.id === -1) {
                    item.id = nextid--;
                }
                if (item instanceof SPFile && item.content && item.content.byteLength >= 10485760) {
                    // remove existing chunks
                    let keys: string[] = await this.getAllKeysInternal(store);
                    let chunkkeys = keys.filter((k) => {
                        const test = k.match(/^.*_chunk_\d+$/g);
                        return test != null && test.length > 0;
                    });
                    await Promise.all(chunkkeys.map((ck) => {
                        return store.delete(ck);
                    }));
                    // add chunked file
                    let idx = 0;
                    let size = 0;
                    while (size < item.content.byteLength) {
                        const firstidx = idx * 10485760;
                        const lastidx = Math.min(item.content.byteLength, firstidx + 10485760);
                        let chunk = item.content.slice(firstidx, lastidx);
                        // create file object
                        let chunkitem = new SPFile();
                        chunkitem.serverRelativeUrl = item.serverRelativeUrl + (idx === 0 ? "" : "_chunk_" + idx);
                        chunkitem.name = item.name;
                        chunkitem.mimeType = item.mimeType;
                        chunkitem.content = chunk;
                        await store.put(assign({}, chunkitem));
                        idx++;
                        size += chunk.byteLength;
                    }

                }
                else {
                    //if item comes from query add property query
                    if (query) {
                        item.queries = new Array<number>();
                        let hash = this.hashCode(query);
                        //get item from cache if exist
                        let temp: IBaseItem = await store.get(item.id);
                        //if exist    
                        if (temp) {
                            //if item never store from query, init array
                            if (!temp.queries) {
                                temp.queries = new Array<number>();
                            }
                            //if query never launched
                            //add query to item db
                            if (temp.queries.indexOf(hash) < 0) {
                                temp.queries.push(hash);
                            }
                            item.queries = temp.queries;
                        } else {
                            item.queries.push(hash);
                        }
                    }

                    await store.put(assign({}, item)); // store simple object with data only 
                }
            }));
            await tx.complete;
            return newItems;
        } catch (error) {
            console.error(error.message + " - " + error.Name);
            tx.abort();
        }
    }


    /**
     * Retrieve all items from db table
     */
    public async getAll(): Promise<Array<T>> {
        let result = new Array<T>();
        await this.OpenDb();
        const transaction = this.db.transaction(this.tableName, 'readonly');
        const store = transaction.objectStore(this.tableName);
        try {
            let rows = await store.getAll();
            rows.forEach((r) => {
                let item = new this.itemType();
                let resultItem = assign(item, ...r);
                if (item instanceof SPFile) {
                    // item is a part of another file
                    const chunkparts = item.id.match(/^.*_chunk_\d+$/g);
                    if (chunkparts == null || chunkparts.length > 0) {
                        // verify if there are other parts
                        let chunks = rows.filter((chunkedrow) => {
                            const test = chunkedrow.id.match(/^.*_chunk_\d+$/g);
                            return test != null && test.length > 0 && chunkedrow.id.indexOf(item.id + "_chunk_") === 0;
                        });
                        if (chunks.length > 0) {
                            chunks.sort((a, b) => {
                                return parseInt(a.id.replace(/^.*_chunk_(\d+)$/g, "$1")) - parseInt(b.id.replace(/^.*_chunk_(\d+)$/g, "$1"));
                            });
                            resultItem.content = UtilsService.concatArrayBuffers(resultItem.content, ...chunks.map(c => c.content));
                        }
                        result.push(resultItem);
                    }
                }
                else {
                    result.push(resultItem);
                }
            });
        } catch (error) {
            console.error(error.message + " - " + error.Name);
            transaction.abort();
        }
        await transaction.complete;
        return result;
    }



    /**
     * Clear table and insert new items
     * @param newItems Items to insert in place of existing
     */
    public async replaceAll(newItems: Array<T>): Promise<void> {
        await this.clear();
        await this.addOrUpdateItems(newItems);
    }

    /**
     * Clear table
     */
    public async clear(): Promise<void> {
        await this.OpenDb();
        const tx = this.db.transaction(this.tableName, 'readwrite');
        const store = tx.objectStore(this.tableName);
        try {
            await store.clear();
            await tx.complete;
        } catch (error) {
            console.error(error.message + " - " + error.Name);
            tx.abort();
        }
    }

    public async getById(id: number | string): Promise<T> {
        let result: T = null;
        await this.OpenDb();
        const tx = this.db.transaction(this.tableName, 'readonly');
        const store = tx.objectStore(this.tableName);
        try {
            let obj = await store.get(id);
            if (obj) {
                result = assign(new this.itemType(), obj);
                if (result instanceof SPFile) {
                    // item is a part of another file
                    const chunkparts = result.id.match(/^.*_chunk_\d+$/g);
                    if (chunkparts == null || chunkparts.length > 0) {
                        let allRows = await store.getAll();
                        // verify if there are other parts
                        let chunks = allRows.filter((chunkedrow) => {
                            const test = chunkedrow.id.match(/^.*_chunk_\d+$/g);
                            return test != null && test.length > 0 && chunkedrow.id.indexOf(result.id + "_chunk_") === 0;
                        });
                        if (chunks.length > 0) {
                            chunks.sort((a, b) => {
                                return parseInt(a.id.replace(/^.*_chunk_(\d+)$/g, "$1")) - parseInt(b.id.replace(/^.*_chunk_(\d+)$/g, "$1"));
                            });
                            result.content = UtilsService.concatArrayBuffers(result.content, ...chunks.map(c => c.content));
                        }
                    }
                    else {
                        // no chunked parts here
                        result = null;
                    }
                }
            }
            await tx.complete;
        } catch (error) {
            console.error(error.message + " - " + error.Name);
            tx.abort();
        }
        return result;
    }
}