import { BaseItem } from "../models";
import { BaseDataService } from "../services";

export interface IFactoryMapping {
    models: {[modelName: string]: new (item?: any) => BaseItem };
    services: {[modelName: string]: new (...args: any[]) => BaseDataService<BaseItem>};
    objects: {[typeName: string]: new () => any};
}