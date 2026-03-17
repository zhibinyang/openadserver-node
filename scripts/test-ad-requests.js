"use strict";
/**
 * Test script to verify all creatives from seed data can be returned by ad requests.
 * This script tests each creative with appropriate request parameters based on:
 * - Creative type (slot_type)
 * - Dimensions (slot_width, slot_height)
 * - Targeting rules (geo, device, age, interest)
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
dotenv.config();
var API_BASE = process.env.API_BASE || 'http://localhost:3000';
// Creative type mapping
var CREATIVE_TYPE_NAMES = {
    1: 'BANNER',
    2: 'NATIVE',
    3: 'VIDEO',
    4: 'INTERSTITIAL',
    5: 'GEO_SNIPPET',
};
// Test user contexts for different targeting scenarios
var TEST_CONTEXTS = {
    // For campaigns with device targeting (android/ios)
    mobile_gamer: {
        os: 'android',
        device: 'Samsung Galaxy S21',
        browser: 'chrome',
        country: 'US',
        city: 'New York',
        age: 25,
        interests: ['gaming', 'tech'],
    },
    // For campaigns with US geo targeting
    us_user: {
        country: 'US',
        city: 'Los Angeles',
        os: 'ios',
        device: 'iPhone 14',
        browser: 'safari',
        age: 30,
        interests: ['shopping', 'tech'],
    },
    // For campaigns with UK/CA geo targeting
    uk_user: {
        country: 'UK',
        city: 'London',
        os: 'android',
        device: 'Pixel 7',
        browser: 'chrome',
        age: 28,
        interests: ['gaming'],
    },
    // For campaigns with age targeting (18-34)
    young_adult: {
        age: 25,
        country: 'US',
        os: 'android',
        device: 'Samsung Galaxy',
        browser: 'chrome',
        interests: ['gaming', 'tech'],
    },
    // For campaigns with age targeting (25-99)
    adult: {
        age: 35,
        country: 'US',
        os: 'ios',
        device: 'iPhone',
        browser: 'safari',
        interests: ['finance', 'investing'],
    },
    // For campaigns with interest targeting (programming, technology)
    developer: {
        age: 28,
        country: 'US',
        os: 'macos',
        device: 'MacBook Pro',
        browser: 'chrome',
        interests: ['programming', 'technology', 'coding'],
    },
    // For campaigns with no targeting (fallback)
    generic_user: {
        country: 'US',
        city: 'Seattle',
        os: 'windows',
        device: 'Desktop',
        browser: 'chrome',
        age: 30,
        interests: ['shopping', 'news'],
    },
    // For food delivery (US geo)
    food_user: {
        country: 'US',
        city: 'New York',
        os: 'ios',
        device: 'iPhone 14',
        browser: 'safari',
        age: 28,
        interests: ['food', 'shopping'],
    },
};
function fetchFromDB(query) {
    return __awaiter(this, void 0, void 0, function () {
        var Pool, pool, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('pg'); })];
                case 1:
                    Pool = (_a.sent()).Pool;
                    pool = new Pool({ connectionString: process.env.DATABASE_URL });
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 6]);
                    return [4 /*yield*/, pool.query(query)];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, result.rows];
                case 4: return [4 /*yield*/, pool.end()];
                case 5:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function postAdRequest(params) {
    return __awaiter(this, void 0, void 0, function () {
        var response, errorText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(API_BASE, "/ad/get"), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(params),
                    })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    errorText = _a.sent();
                    throw new Error("HTTP ".concat(response.status, ": ").concat(errorText));
                case 3: return [2 /*return*/, response.json()];
            }
        });
    });
}
/**
 * Determine the best test context for a campaign based on its targeting rules
 */
function getTestContextForCampaign(rules, campaignId) {
    var _a, _b, _c, _d, _e, _f;
    var campaignRules = rules.filter(function (r) { return r.campaign_id === campaignId; });
    if (campaignRules.length === 0) {
        // No targeting rules - use generic user
        return TEST_CONTEXTS.generic_user;
    }
    // Build a context that satisfies all rules
    var context = __assign({}, TEST_CONTEXTS.generic_user);
    for (var _i = 0, campaignRules_1 = campaignRules; _i < campaignRules_1.length; _i++) {
        var rule = campaignRules_1[_i];
        switch (rule.rule_type) {
            case 'geo':
                if (((_a = rule.rule_value.countries) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    context.country = rule.rule_value.countries[0];
                }
                if (((_b = rule.rule_value.cities) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                    context.city = rule.rule_value.cities[0];
                }
                break;
            case 'device':
                if (((_c = rule.rule_value.os) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                    context.os = rule.rule_value.os[0];
                }
                if (((_d = rule.rule_value.browser) === null || _d === void 0 ? void 0 : _d.length) > 0) {
                    context.browser = rule.rule_value.browser[0];
                }
                if (((_e = rule.rule_value.device) === null || _e === void 0 ? void 0 : _e.length) > 0) {
                    context.device = rule.rule_value.device[0];
                }
                break;
            case 'age':
                if (rule.rule_value.min && rule.rule_value.max) {
                    context.age = Math.floor((rule.rule_value.min + rule.rule_value.max) / 2);
                }
                else if (rule.rule_value.min) {
                    context.age = rule.rule_value.min + 5;
                }
                break;
            case 'interest':
                if (((_f = rule.rule_value.values) === null || _f === void 0 ? void 0 : _f.length) > 0) {
                    context.interests = rule.rule_value.values;
                }
                break;
        }
    }
    return context;
}
/**
 * Build ad request parameters for a creative
 */
function buildRequestParams(creative, context) {
    var params = __assign({ slot_id: "test_slot_".concat(creative.id), slot_type: creative.creative_type, slot_width: creative.width, slot_height: creative.height, user_id: "test_user_".concat(Date.now()), ip: '8.8.8.8', num_ads: 10 }, context);
    // For video creatives, we might want to test VAST endpoint too
    // But for now, use the standard /ad/get endpoint
    return params;
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var creatives, campaigns, campaignMap, rules, results, passCount, failCount, _loop_1, _i, creatives_1, creative, _a, _b, r;
        var _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    console.log('='.repeat(60));
                    console.log('Ad Request Test Script');
                    console.log('='.repeat(60));
                    console.log("API Base: ".concat(API_BASE));
                    console.log('');
                    // 1. Fetch all creatives from database
                    console.log('Fetching creatives from database...');
                    return [4 /*yield*/, fetchFromDB("\n        SELECT id, campaign_id, title, creative_type, width, height, duration\n        FROM creatives\n        WHERE status = 1\n        ORDER BY campaign_id, id\n    ")];
                case 1:
                    creatives = _f.sent();
                    console.log("Found ".concat(creatives.length, " active creatives\n"));
                    // 2. Fetch campaigns
                    console.log('Fetching campaigns...');
                    return [4 /*yield*/, fetchFromDB("\n        SELECT id, name, advertiser_id, bid_type, pacing_type\n        FROM campaigns\n        WHERE status = 1 AND is_active = true\n    ")];
                case 2:
                    campaigns = _f.sent();
                    campaignMap = new Map(campaigns.map(function (c) { return [c.id, c]; }));
                    console.log("Found ".concat(campaigns.length, " active campaigns\n"));
                    // 3. Fetch targeting rules
                    console.log('Fetching targeting rules...');
                    return [4 /*yield*/, fetchFromDB("\n        SELECT campaign_id, rule_type, rule_value, is_include\n        FROM targeting_rules\n    ")];
                case 3:
                    rules = _f.sent();
                    console.log("Found ".concat(rules.length, " targeting rules\n"));
                    results = [];
                    passCount = 0;
                    failCount = 0;
                    console.log('Testing creatives...');
                    console.log('-'.repeat(60));
                    _loop_1 = function (creative) {
                        var campaign, context, params, result, response, found, error_1;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    campaign = campaignMap.get(creative.campaign_id);
                                    if (!campaign) {
                                        console.log("  Skipping creative ".concat(creative.id, ": campaign not found"));
                                        return [2 /*return*/, "continue"];
                                    }
                                    context = getTestContextForCampaign(rules, creative.campaign_id);
                                    params = buildRequestParams(creative, context);
                                    result = {
                                        creativeId: creative.id,
                                        creativeTitle: creative.title,
                                        campaignId: creative.campaign_id,
                                        campaignName: campaign.name,
                                        creativeType: CREATIVE_TYPE_NAMES[creative.creative_type] || "TYPE_".concat(creative.creative_type),
                                        passed: false,
                                        requestParams: params,
                                        responseCount: 0,
                                    };
                                    _g.label = 1;
                                case 1:
                                    _g.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, postAdRequest(params)];
                                case 2:
                                    response = _g.sent();
                                    found = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c.some(function (ad) { return ad.creative_id === creative.id; });
                                    if (found) {
                                        result.passed = true;
                                        result.responseCount = ((_d = response.candidates) === null || _d === void 0 ? void 0 : _d.length) || 0;
                                        passCount++;
                                        console.log("  [PASS] Creative ".concat(creative.id, " (").concat(creative.title, ")"));
                                    }
                                    else {
                                        result.passed = false;
                                        result.responseCount = ((_e = response.candidates) === null || _e === void 0 ? void 0 : _e.length) || 0;
                                        result.error = 'Creative not found in response';
                                        failCount++;
                                        console.log("  [FAIL] Creative ".concat(creative.id, " (").concat(creative.title, ") - not in response"));
                                        console.log("         Campaign: ".concat(campaign.name));
                                        console.log("         Type: ".concat(result.creativeType, " (").concat(creative.width, "x").concat(creative.height, ")"));
                                        console.log("         Context: country=".concat(context.country, ", os=").concat(context.os, ", age=").concat(context.age));
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_1 = _g.sent();
                                    result.error = error_1.message;
                                    failCount++;
                                    console.log("  [ERROR] Creative ".concat(creative.id, " (").concat(creative.title, ") - ").concat(error_1.message));
                                    return [3 /*break*/, 4];
                                case 4:
                                    results.push(result);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, creatives_1 = creatives;
                    _f.label = 4;
                case 4:
                    if (!(_i < creatives_1.length)) return [3 /*break*/, 7];
                    creative = creatives_1[_i];
                    return [5 /*yield**/, _loop_1(creative)];
                case 5:
                    _f.sent();
                    _f.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7:
                    // 5. Summary
                    console.log('\n' + '='.repeat(60));
                    console.log('SUMMARY');
                    console.log('='.repeat(60));
                    console.log("Total creatives tested: ".concat(results.length));
                    console.log("Passed: ".concat(passCount));
                    console.log("Failed: ".concat(failCount));
                    if (failCount > 0) {
                        console.log('\nFailed creatives details:');
                        console.log('-'.repeat(60));
                        for (_a = 0, _b = results.filter(function (r) { return !r.passed; }); _a < _b.length; _a++) {
                            r = _b[_a];
                            console.log("\nCreative ".concat(r.creativeId, ": ").concat(r.creativeTitle));
                            console.log("  Campaign: ".concat(r.campaignName));
                            console.log("  Type: ".concat(r.creativeType));
                            console.log("  Error: ".concat(r.error));
                            console.log("  Request params: ".concat(JSON.stringify(r.requestParams, null, 2).split('\n').join('\n    ')));
                        }
                    }
                    // 6. Exit code
                    process.exit(failCount > 0 ? 1 : 0);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('Fatal error:', err);
    process.exit(1);
});
