import { BaseComponentContext } from "@microsoft/sp-component-base";
import { Constants } from "../../constants/index";
import { TaxonomyHidden } from "../../models/";
import { BaseListItemService } from "../base/BaseListItemService";



const cacheDuration: number = 10;

/**
 * Service allowing to retrieve risks (online only)
 */
export class TaxonomyHiddenListService extends BaseListItemService<TaxonomyHidden> {


    constructor() {
        super(TaxonomyHidden, Constants.taxonomyHiddenList.relativeUrl, Constants.taxonomyHiddenList.tableName, cacheDuration);

    }


}