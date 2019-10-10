import { IDataService } from "../../interfaces/IDataService";
import { IBaseItem } from "../../interfaces/index";
import { BaseDataService } from "./BaseDataService";
/**
 * Base service for sp files operations
 */
export declare class BaseFileService<T extends IBaseItem> extends BaseDataService<T> implements IDataService<T> {
    protected itemType: (new (item?: any) => T);
    protected listRelativeUrl: string;
    /**
     * Associeted list (pnpjs)
     */
    protected readonly list: import("@pnp/sp").List;
    /**
     *
     * @param type items type
     * @param context current sp component context
     * @param listRelativeUrl list web relative url
     */
    constructor(type: (new (item?: any) => T), listRelativeUrl: string, tableName: string);
    /**
     * Retrieve all items
     */
    getAll_Internal(): Promise<Array<T>>;
    get_Internal(query: any): Promise<Array<T>>;
    getById_Internal(query: any): Promise<T>;
    private createFileObject;
    getFilesInFolder(folderListRelativeUrl: any): Promise<Array<T>>;
    folderExists(folderUrl: any): Promise<boolean>;
    addOrUpdateItem_Internal(item: T): Promise<T>;
    deleteItem_Internal(item: T): Promise<void>;
}