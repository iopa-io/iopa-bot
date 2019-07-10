"use strict";
/*
 * Iopa Bot Framework
 * Copyright (c) 2016-2019 Internet of Protocols Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Iopa = require("iopa");
const { IOPA, SERVER } = Iopa.constants;
const constants_1 = require("../constants");
class Dialog {
    constructor(name, steps) {
        this.name = name;
        this.steps = steps;
    }
}
class DialogManager {
    constructor(app) {
        this.dialogs = {};
        this.app = app;
        app.dialog = (name, ...args) => {
            if (!(typeof name === 'string')) {
                throw new Error('dialog must start with dialog name, then array of intents, then function to call');
            }
            this.dialogs[name] = new Dialog(name, args);
        };
        app.properties[SERVER.Capabilities][constants_1.BOT.CAPABILITIES.Dialog] = {
            beginDialog: (name, context, next) => {
                const dialog = this.dialogs[name];
                if (!dialog)
                    throw new Error('Dialog not recognized');
                let dialogFunc = dialog.steps[0];
                if (typeof dialogFunc != 'function') {
                    dialogFunc = dialog.steps[1];
                    context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog] = {
                        name: dialog.name,
                        step: 2,
                        totalSteps: dialog.steps.length
                    };
                }
                else {
                    context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog] = {
                        name: dialog.name,
                        step: 1,
                        totalSteps: dialog.steps.length
                    };
                }
                return dialogFunc(context, next);
            }
        };
        app.properties[SERVER.Capabilities][constants_1.BOT.CAPABILITIES.Dialog][IOPA.Version] =
            constants_1.BOT.VERSION;
    }
    invoke(context, next) {
        if (context['urn:bot:dialog:invoke']) {
            const dialogId = context['urn:bot:dialog:invoke'];
            return context[SERVER.Capabilities][constants_1.BOT.CAPABILITIES.Dialog].beginDialog(dialogId, context, next);
        }
        if (!context[constants_1.BOT.Intent])
            return next();
        // must have an intent to process dialog
        console.log('>> skill', context[constants_1.BOT.Session][constants_1.BOT.Skill]);
        console.log('>> intent', context[constants_1.BOT.Intent]);
        console.log('>> dialog', context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog]);
        if (!context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog])
            return this._matchBeginDialog(context, next);
        return this._continueDialog(context, next);
    }
    _matchBeginDialog(context, next) {
        let dialogFunc = null;
        for (var key in this.dialogs) {
            const dialog = this.dialogs[key];
            if (typeof dialog.steps[0] != 'function') {
                let intents = dialog.steps[0];
                if (intents.includes(context[constants_1.BOT.Intent]) || intents.includes('*')) {
                    dialogFunc = dialog.steps[1];
                    context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog] = {
                        name: dialog.name,
                        step: 2,
                        totalSteps: dialog.steps.length
                    };
                    break;
                }
            }
        }
        if (dialogFunc)
            return dialogFunc(context, next);
        else
            return next();
    }
    _continueDialog(context, next) {
        var sessionDialog = context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog];
        var dialog = this.dialogs[sessionDialog.name];
        if (!dialog) {
            // not a recognized dialog so clear
            context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog] = null;
            return this._matchBeginDialog(context, next);
        }
        if (sessionDialog.step >= dialog.steps.length) {
            // was at end of dialog so just clear
            context[constants_1.BOT.Session][constants_1.BOT.CurrentDialog] = null;
            context[constants_1.BOT.Session][constants_1.BOT.LastDialogEndedDate] = new Date().getTime();
            return this._matchBeginDialog(context, next);
        }
        let intentFilter;
        let dialogFunc;
        intentFilter = dialog.steps[sessionDialog.step];
        if (typeof intentFilter == 'function') {
            // Dialog step has no intent filter, invoke dialogFunc
            dialogFunc = intentFilter;
            intentFilter = null;
        }
        else if (intentFilter &&
            !intentFilter.includes(context[constants_1.BOT.Intent]) &&
            !intentFilter.includes('*')) {
            // No matching intent for current dialog step, see if we should start another dialog
            return this._matchBeginDialog(context, next);
        }
        else {
            // Match with current dialog step intent filter, advance and invoke dialogFunc
            sessionDialog.step++;
            dialogFunc = dialog.steps[sessionDialog.step];
        }
        sessionDialog.step++;
        return dialogFunc(context, next);
    }
}
exports.default = DialogManager;
