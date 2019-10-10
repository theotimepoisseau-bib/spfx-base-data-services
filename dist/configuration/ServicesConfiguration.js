import { sp } from "@pnp/sp";
import { taxonomy } from "@pnp/sp-taxonomy";
import { Constants } from "../constants";
import { find } from "@microsoft/sp-lodash-subset";
var ServicesConfiguration = /** @class */ (function () {
    function ServicesConfiguration() {
    }
    Object.defineProperty(ServicesConfiguration, "context", {
        get: function () {
            return ServicesConfiguration.configuration.context;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ServicesConfiguration, "configuration", {
        get: function () {
            return ServicesConfiguration.configurationInternal;
        },
        enumerable: true,
        configurable: true
    });
    ServicesConfiguration.Init = function (configuration) {
        ServicesConfiguration.configurationInternal = configuration;
        configuration.tableNames = configuration.tableNames || [];
        if (!find(configuration.tableNames, function (s) { return s === Constants.taxonomyHiddenList.tableName; })) {
            configuration.tableNames.push(Constants.taxonomyHiddenList.tableName);
        }
        sp.setup({
            spfxContext: ServicesConfiguration.context,
            sp: {
                headers: {
                    "Accept": "application/json; odata=verbose",
                    'Cache-Control': 'no-cache'
                }
            }
        });
        taxonomy.setup({
            spfxContext: ServicesConfiguration.context,
            sp: {
                headers: {
                    "Accept": "application/json; odata=verbose",
                    'Cache-Control': 'no-cache'
                }
            }
        });
    };
    ServicesConfiguration.configurationInternal = {
        DbName: "spfx-db",
        Version: 1,
        checkOnline: false,
        context: null,
        serviceFactory: null,
        tableNames: [],
        translations: {
            AddLabel: "Add",
            DeleteLabel: "Delete",
            IndexedDBNotDefined: "IDB not defined",
            SynchronisationErrorFormat: "Sync error",
            UpdateLabel: "Update",
            UploadLabel: "Upload",
            versionHigherErrorMessage: "Version conflict",
            typeTranslations: []
        }
    };
    return ServicesConfiguration;
}());
export { ServicesConfiguration };
//# sourceMappingURL=ServicesConfiguration.js.map