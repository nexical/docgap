"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const core = __importStar(require("@actions/core"));
const path_1 = __importDefault(require("path"));
const core_1 = require("@docgap/core");
async function run() {
    try {
        const configPathInput = core.getInput('config') || '.docgap.yaml';
        const strict = core.getInput('strict') === 'true';
        const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
        const configPath = path_1.default.resolve(workspace, configPathInput);
        core.info(`Configuration: ${configPath}`);
        core.info(`Strict Mode: ${strict}`);
        let config;
        try {
            config = await (0, core_1.loadConfigFromPath)(configPath);
        }
        catch (e) {
            core.setFailed(`Could not load config: ${e.message}`);
            return;
        }
        core.info('Running drift analysis...');
        const results = await (0, core_1.runAnalysis)(workspace, config);
        let hasDrift = false;
        let driftCount = 0;
        for (const result of results) {
            if (result.status !== 'FRESH') {
                hasDrift = true;
                driftCount++;
                const message = `Documentation is stale. Reason: ${result.driftReason || 'Unknown'}`;
                const annotationProperties = {
                    title: 'Drift Detected',
                    file: path_1.default.relative(workspace, result.docPath)
                };
                if (strict) {
                    core.error(message, annotationProperties);
                }
                else {
                    core.warning(message, annotationProperties);
                }
            }
        }
        if (hasDrift) {
            core.startGroup('🔧 How to Fix');
            core.info('Run npx docgap fix to update automatically.');
            core.endGroup();
            if (strict) {
                core.setFailed(`Drift detected in ${driftCount} file(s).`);
            }
            else {
                core.info(`Drift detected in ${driftCount} file(s), but strict mode is off.`);
            }
        }
        else {
            core.info('✅ Documentation is fresh.');
        }
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}
// Only run if called directly
// istanbul ignore next
/* v8 ignore next 3 */
if (require.main === module) {
    run();
}
