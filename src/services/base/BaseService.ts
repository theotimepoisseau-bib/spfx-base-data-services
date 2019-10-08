import { BaseComponentContext } from "@microsoft/sp-component-base";

import { sp } from "@pnp/sp";
import { taxonomy } from "@pnp/sp-taxonomy";
import { SPWeb } from "@microsoft/sp-page-context";
import { IConfiguration } from "../../interfaces";
import { Constants } from "../../constants";
import { find } from "@microsoft/sp-lodash-subset";

export abstract class BaseService {

    protected static Configuration: IConfiguration;

    public static Init(configuration: IConfiguration): void {
        BaseService.Configuration = configuration;
        configuration.tableNames = configuration.tableNames || [];
        if(!find(configuration.tableNames, (s) => {return s === Constants.taxonomyHiddenList.tableName})) {
            configuration.tableNames.push(Constants.taxonomyHiddenList.tableName);
        } 
        sp.setup({
            spfxContext: BaseService.Configuration.context
        });
        taxonomy.setup({
            spfxContext: BaseService.Configuration.context
        });
    }


    protected hashCode(str: String): number {
        var hash = 0;
        if (str.length == 0) return hash;
        for (let i = 0; i < str.length; i++) {
            let char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    constructor() {
    }

    public getDomainUrl(web: SPWeb): string {
        return web.absoluteUrl.replace(web.serverRelativeUrl, "");
    }
}