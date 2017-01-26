import KeyTable from "./keysym.js";
import keysyms from "./keysymdef.js";
import vkeys from "./vkeys.js";
import fixedkeys from "./fixedkeys.js";

function isMac() {
    return navigator && !!(/mac/i).exec(navigator.platform);
}
function isWindows() {
    return navigator && !!(/win/i).exec(navigator.platform);
}
function isLinux() {
    return navigator && !!(/linux/i).exec(navigator.platform);
}

// Return true if the specified char modifier is currently down
export function hasCharModifier(charModifier, currentModifiers) {
    if (charModifier.length === 0) { return false; }

    for (var i = 0; i < charModifier.length; ++i) {
        if (!currentModifiers[charModifier[i]]) {
            return false;
        }
    }
    return true;
}

// Helper object tracking modifier key state
// and generates fake key events to compensate if it gets out of sync
export function ModifierSync(charModifier) {
    if (!charModifier) {
        if (isMac()) {
            // on Mac, Option (AKA Alt) is used as a char modifier
            charModifier = [KeyTable.XK_Alt_L];
        }
        else if (isWindows()) {
            // on Windows, Ctrl+Alt is used as a char modifier
            charModifier = [KeyTable.XK_Alt_L, KeyTable.XK_Control_L];
        }
        else if (isLinux()) {
            // on Linux, ISO Level 3 Shift (AltGr) is used as a char modifier
            charModifier = [KeyTable.XK_ISO_Level3_Shift];
        }
        else {
            charModifier = [];
        }
    }

    var state = {};
    state[KeyTable.XK_Control_L] = false;
    state[KeyTable.XK_Alt_L] = false;
    state[KeyTable.XK_ISO_Level3_Shift] = false;
    state[KeyTable.XK_Shift_L] = false;
    state[KeyTable.XK_Meta_L] = false;

    function sync(evt, keysym) {
        var result = [];
        function syncKey(keysym) {
            return {keysym: keysym, type: state[keysym] ? 'keydown' : 'keyup'};
        }

        if (evt.ctrlKey !== undefined &&
            evt.ctrlKey !== state[KeyTable.XK_Control_L] && keysym !== KeyTable.XK_Control_L) {
            state[KeyTable.XK_Control_L] = evt.ctrlKey;
            result.push(syncKey(KeyTable.XK_Control_L));
        }
        if (evt.altKey !== undefined &&
            evt.altKey !== state[KeyTable.XK_Alt_L] && keysym !== KeyTable.XK_Alt_L) {
            state[KeyTable.XK_Alt_L] = evt.altKey;
            result.push(syncKey(KeyTable.XK_Alt_L));
        }
        if (evt.altGraphKey !== undefined &&
            evt.altGraphKey !== state[KeyTable.XK_ISO_Level3_Shift] && keysym !== KeyTable.XK_ISO_Level3_Shift) {
            state[KeyTable.XK_ISO_Level3_Shift] = evt.altGraphKey;
            result.push(syncKey(KeyTable.XK_ISO_Level3_Shift));
        }
        if (evt.shiftKey !== undefined &&
            evt.shiftKey !== state[KeyTable.XK_Shift_L] && keysym !== KeyTable.XK_Shift_L) {
            state[KeyTable.XK_Shift_L] = evt.shiftKey;
            result.push(syncKey(KeyTable.XK_Shift_L));
        }
        if (evt.metaKey !== undefined &&
            evt.metaKey !== state[KeyTable.XK_Meta_L] && keysym !== KeyTable.XK_Meta_L) {
            state[KeyTable.XK_Meta_L] = evt.metaKey;
            result.push(syncKey(KeyTable.XK_Meta_L));
        }
        return result;
    }
    function syncKeyEvent(evt, down) {
        var keysym = getKeysym(evt);

        // first, apply the event itself, if relevant
        if (keysym !== null && state[keysym] !== undefined) {
            state[keysym] = down;
        }
        return sync(evt, keysym);
    }

    return {
        // sync on the appropriate keyboard event
        keydown: function(evt) { return syncKeyEvent(evt, true);},
        keyup: function(evt) { return syncKeyEvent(evt, false);},
        // Call this with a non-keyboard event (such as mouse events) to use its modifier state to synchronize anyway
        syncAny: function(evt) { return sync(evt);},

        // if a char modifier is down, return the keys it consists of, otherwise return null
        activeCharModifier: function() { return hasCharModifier(charModifier, state) ? charModifier : null; }
    };
}

// Get 'KeyboardEvent.code', handling legacy browsers
export function getKeycode(evt){
    // Are we getting proper key identifiers?
    // (unfortunately Firefox and Chrome are crappy here and gives
    // us an empty string on some platforms, rather than leaving it
    // undefined)
    if (evt.code) {
        // Mozilla isn't fully in sync with the spec yet
        switch (evt.code) {
            case 'OSLeft': return 'MetaLeft';
            case 'OSRight': return 'MetaRight';
        }

        return evt.code;
    }

    // The de-facto standard is to use Windows Virtual-Key codes
    // in the 'keyCode' field for non-printable characters. However
    // Webkit sets it to the same as charCode in 'keypress' events.
    if ((evt.type !== 'keypress') && (evt.keyCode in vkeys)) {
        var code = vkeys[evt.keyCode];

        // macOS has messed up this code for some reason
        if (isMac() && (code === 'ContextMenu')) {
            code = 'MetaRight';
        }

        // The keyCode doesn't distinguish between left and right
        // for the standard modifiers
        if (evt.location === 2) {
            switch (code) {
                case 'ShiftLeft': return 'ShiftRight';
                case 'ControlLeft': return 'ControlRight';
                case 'AltLeft': return 'AltRight';
            }
        }

        // Nor a bunch of the numpad keys
        if (evt.location === 3) {
            switch (code) {
                case 'Delete': return 'NumpadDecimal';
                case 'Insert': return 'Numpad0';
                case 'End': return 'Numpad1';
                case 'ArrowDown': return 'Numpad2';
                case 'PageDown': return 'Numpad3';
                case 'ArrowLeft': return 'Numpad4';
                case 'ArrowRight': return 'Numpad6';
                case 'Home': return 'Numpad7';
                case 'ArrowUp': return 'Numpad8';
                case 'PageUp': return 'Numpad9';
                case 'Enter': return 'NumpadEnter';
            }
        }

        return code;
    }

    return 'Unidentified';
}

// Get the most reliable keysym value we can get from a key event
export function getKeysym(evt){

    // We start with layout independent keys
    var code = getKeycode(evt);
    if (code in fixedkeys) {
        return fixedkeys[code];
    }

    // Next with mildly layout or state sensitive stuff

    // Like AltGraph
    if (code === 'AltRight') {
        if (evt.key === 'AltGraph') {
            return KeyTable.XK_ISO_Level3_Shift;
        } else {
            return KeyTable.XK_Alt_R;
        }
    }

    // Or the numpad
    if (evt.location === 3) {
        var key = evt.key;

        // IE and Edge use some ancient version of the spec
        // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8860571/
        switch (key) {
            case 'Up': key = 'ArrowUp'; break;
            case 'Left': key = 'ArrowLeft'; break;
            case 'Right': key = 'ArrowRight'; break;
            case 'Down': key = 'ArrowDown'; break;
            case 'Del': key = 'Delete'; break;
        }

        // Safari doesn't support KeyboardEvent.key yet
        if ((key === undefined) && (evt.charCode)) {
            key = String.fromCharCode(evt.charCode);
        }

        switch (key) {
            case '0': return KeyTable.XK_KP_0;
            case '1': return KeyTable.XK_KP_1;
            case '2': return KeyTable.XK_KP_2;
            case '3': return KeyTable.XK_KP_3;
            case '4': return KeyTable.XK_KP_4;
            case '5': return KeyTable.XK_KP_5;
            case '6': return KeyTable.XK_KP_6;
            case '7': return KeyTable.XK_KP_7;
            case '8': return KeyTable.XK_KP_8;
            case '9': return KeyTable.XK_KP_9;
            // There is utter mayhem in the world when it comes to which
            // character to use as a decimal separator...
            case '.': return KeyTable.XK_KP_Decimal;
            case ',': return KeyTable.XK_KP_Separator;
            case 'Home': return KeyTable.XK_KP_Home;
            case 'End': return KeyTable.XK_KP_End;
            case 'PageUp': return KeyTable.XK_KP_Prior;
            case 'PageDown': return KeyTable.XK_KP_Next;
            case 'Insert': return KeyTable.XK_KP_Insert;
            case 'Delete': return KeyTable.XK_KP_Delete;
            case 'ArrowUp': return KeyTable.XK_KP_Up;
            case 'ArrowLeft': return KeyTable.XK_KP_Left;
            case 'ArrowRight': return KeyTable.XK_KP_Right;
            case 'ArrowDown': return KeyTable.XK_KP_Down;
        }
    }

    // Now we need to look at the Unicode symbol instead

    var codepoint;

    if ('key' in evt) {
        // Special key? (FIXME: Should have been caught earlier)
        if (evt.key.length !== 1) {
            return null;
        }

        codepoint = evt.key.charCodeAt();
    } else if ('charCode' in evt) {
        codepoint = evt.charCode;
    }

    if (codepoint) {
        return keysyms.lookup(codepoint);
    }

    return null;
}

// Takes a DOM keyboard event and:
// - determines which keysym it represents
// - determines a code identifying the key that was pressed (corresponding to the code/keyCode properties on the DOM event)
// - synthesizes events to synchronize modifier key state between which modifiers are actually down, and which we thought were down
// - marks each event with an 'escape' property if a modifier was down which should be "escaped"
// This information is collected into an object which is passed to the next() function. (one call per event)
export function KeyEventDecoder (modifierState, next) {
    "use strict";
    function sendAll(evts) {
        for (var i = 0; i < evts.length; ++i) {
            next(evts[i]);
        }
    }
    function process(evt, type) {
        var result = {type: type};
        var code = getKeycode(evt);
        if (code === 'Unidentified') {
            // Unstable, but we don't have anything else to go on
            // (don't use it for 'keypress' events thought since
            // WebKit sets it to the same as charCode)
            if (evt.keyCode && (evt.type !== 'keypress')) {
                code = 'Platform' + evt.keyCode;
            }
        }
        result.code = code;

        var keysym = getKeysym(evt);

        // Is this a case where we have to decide on the keysym right away, rather than waiting for the keypress?
        // "special" keys like enter, tab or backspace don't send keypress events,
        // and some browsers don't send keypresses at all if a modifier is down
        if (keysym) {
            result.keysym = keysym;
        }

        // Should we prevent the browser from handling the event?
        // Doing so on a keydown (in most browsers) prevents keypress from being generated
        // so only do that if we have to.
        var suppress = type !== 'keydown' || !!keysym;

        // if a char modifier is pressed, get the keys it consists of (on Windows, AltGr is equivalent to Ctrl+Alt)
        var active = modifierState.activeCharModifier();

        // If we have a char modifier down, and we're able to determine a keysym reliably
        // then (a) we know to treat the modifier as a char modifier,
        // and (b) we'll have to "escape" the modifier to undo the modifier when sending the char.
        if (active && keysym) {
            var isCharModifier = false;
            for (var i  = 0; i < active.length; ++i) {
                if (active[i] === keysym) {
                    isCharModifier = true;
                }
            }
            if (type === 'keypress' && !isCharModifier) {
                result.escape = modifierState.activeCharModifier();
            }
        }

        next(result);

        return suppress;
    }

    return {
        keydown: function(evt) {
            sendAll(modifierState.keydown(evt));
            return process(evt, 'keydown');
        },
        keypress: function(evt) {
            return process(evt, 'keypress');
        },
        keyup: function(evt) {
            sendAll(modifierState.keyup(evt));
            return process(evt, 'keyup');
        },
        syncModifiers: function(evt) {
            sendAll(modifierState.syncAny(evt));
        },
        releaseAll: function() { next({type: 'releaseall'}); }
    };
};

// Keeps track of which keys we (and the server) believe are down
// When a keyup is received, match it against this list, to determine the corresponding keysym(s)
// in some cases, a single key may produce multiple keysyms, so the corresponding keyup event must release all of these chars
// key repeat events should be merged into a single entry.
// Because we can't always identify which entry a keydown or keyup event corresponds to, we sometimes have to guess
export function TrackKeyState (next) {
    "use strict";
    var state = [];

    return function (evt) {
        var last = state.length !== 0 ? state[state.length-1] : null;

        switch (evt.type) {
        case 'keydown':
            // insert a new entry if last seen key was different.
            if (!last || evt.code === 'Unidentified' || last.code !== evt.code) {
                last = {code: evt.code, keysyms: {}};
                state.push(last);
            }
            if (evt.keysym) {
                // make sure last event contains this keysym (a single "logical" keyevent
                // can cause multiple key events to be sent to the VNC server)
                last.keysyms[evt.keysym] = evt.keysym;
                last.ignoreKeyPress = true;
                next(evt);
            }
            break;
        case 'keypress':
            if (!last) {
                last = {code: evt.code, keysyms: {}};
                state.push(last);
            }
            if (!evt.keysym) {
                console.log('keypress with no keysym:', evt);
            }

            // If we didn't expect a keypress, and already sent a keydown to the VNC server
            // based on the keydown, make sure to skip this event.
            if (evt.keysym && !last.ignoreKeyPress) {
                last.keysyms[evt.keysym] = evt.keysym;
                evt.type = 'keydown';
                next(evt);
            }
            break;
        case 'keyup':
            if (state.length === 0) {
                return;
            }
            var idx = null;
            // do we have a matching key tracked as being down?
            for (var i = 0; i !== state.length; ++i) {
                if (state[i].code === evt.code) {
                    idx = i;
                    break;
                }
            }
            // if we couldn't find a match (it happens), assume it was the last key pressed
            if (idx === null) {
                idx = state.length - 1;
            }

            var item = state.splice(idx, 1)[0];
            // for each keysym tracked by this key entry, clone the current event and override the keysym
            var clone = (function(){
                function Clone(){}
                return function (obj) { Clone.prototype=obj; return new Clone(); };
            }());
            for (var key in item.keysyms) {
                var out = clone(evt);
                out.keysym = item.keysyms[key];
                next(out);
            }
            break;
        case 'releaseall':
            /* jshint shadow: true */
            for (var i = 0; i < state.length; ++i) {
                for (var key in state[i].keysyms) {
                    var keysym = state[i].keysyms[key];
                    next({code: 'Unidentified', keysym: keysym, type: 'keyup'});
                }
            }
            /* jshint shadow: false */
            state = [];
        }
    };
};

// Handles "escaping" of modifiers: if a char modifier is used to produce a keysym (such as AltGr-2 to generate an @),
// then the modifier must be "undone" before sending the @, and "redone" afterwards.
export function EscapeModifiers (next) {
    "use strict";
    return function(evt) {
        if (evt.type !== 'keydown' || evt.escape === undefined) {
            next(evt);
            return;
        }
        // undo modifiers
        for (var i = 0; i < evt.escape.length; ++i) {
            next({type: 'keyup', code: 'Unidentified', keysym: evt.escape[i]});
        }
        // send the character event
        next(evt);
        // redo modifiers
        /* jshint shadow: true */
        for (var i = 0; i < evt.escape.length; ++i) {
            next({type: 'keydown', code: 'Unidentified', keysym: evt.escape[i]});
        }
        /* jshint shadow: false */
    };
};
