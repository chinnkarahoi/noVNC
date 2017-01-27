var assert = chai.assert;
var expect = chai.expect;

import { Keyboard } from '../core/input/devices.js';
import keysyms from '../core/input/keysymdef.js';
import * as KeyboardUtil from '../core/input/util.js';

/* jshint newcap: false, expr: true */
describe('Key Event Handling', function() {
    "use strict";

    // The real KeyboardEvent constructor might not work everywhere we
    // want to run these tests
    function keyevent(typeArg, KeyboardEventInit) {
        var e = { type: typeArg };
        for (var key in KeyboardEventInit) {
            e[key] = KeyboardEventInit[key];
        }
        e.stopPropagation = sinon.spy();
        e.preventDefault = sinon.spy();
        return e;
    };

    describe('Decode Keyboard Events', function() {
        it('should decode keydown events', function(done) {
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                expect(keysym).to.be.equal(0x61);
                expect(code).to.be.equal('KeyA');
                expect(down).to.be.equal(true);
                done();
            }});
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'a'}));
        });
        it('should decode keyup events', function(done) {
            var calls = 0;
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                expect(keysym).to.be.equal(0x61);
                expect(code).to.be.equal('KeyA');
                if (calls++ === 1) {
                    expect(down).to.be.equal(false);
                    done();
                }
            }});
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'a'}));
            kbd._handleKeyUp(keyevent('keyup', {code: 'KeyA', key: 'a'}));
        });

        describe('Legacy keypress Events', function() {
            it('should wait for keypress when needed', function() {
                var callback = sinon.spy();
                var kbd = new Keyboard({onKeyEvent: callback});
                kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', keyCode: 0x41}));
                expect(callback).to.not.have.been.called;
            });
            it('should decode keypress events', function(done) {
                var kbd = new Keyboard({
                onKeyEvent: function(keysym, code, down) {
                    expect(keysym).to.be.equal(0x61);
                    expect(code).to.be.equal('KeyA');
                    expect(down).to.be.equal(true);
                    done();
                }});
                kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', keyCode: 0x41}));
                kbd._handleKeyPress(keyevent('keypress', {code: 'KeyA', charCode: 0x61}));
            });
            it('should ignore keypress with different code', function() {
                var callback = sinon.spy();
                var kbd = new Keyboard({onKeyEvent: callback});
                kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', keyCode: 0x41}));
                kbd._handleKeyPress(keyevent('keypress', {code: 'KeyB', charCode: 0x61}));
                expect(callback).to.not.have.been.called;
            });
            it('should handle keypress with missing code', function(done) {
                var kbd = new Keyboard({
                onKeyEvent: function(keysym, code, down) {
                    expect(keysym).to.be.equal(0x61);
                    expect(code).to.be.equal('KeyA');
                    expect(down).to.be.equal(true);
                    done();
                }});
                kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', keyCode: 0x41}));
                kbd._handleKeyPress(keyevent('keypress', {charCode: 0x61}));
            });
        });

        describe('suppress the right events at the right time', function() {
            it('should suppress anything with a valid key', function() {
                var kbd = new Keyboard({});
                var evt = keyevent('keydown', {code: 'KeyA', key: 'a'});
                kbd._handleKeyDown(evt);
                expect(evt.preventDefault).to.have.been.called;
                evt = keyevent('keyup', {code: 'KeyA', key: 'a'});
                kbd._handleKeyUp(evt);
                expect(evt.preventDefault).to.have.been.called;
            });
            it('should not suppress keys without key', function() {
                var kbd = new Keyboard({});
                var evt = keyevent('keydown', {code: 'KeyA', keyCode: 0x41});
                kbd._handleKeyDown(evt);
                expect(evt.preventDefault).to.not.have.been.called;
            });
            it('should suppress the following keypress event', function() {
                var kbd = new Keyboard({});
                var evt = keyevent('keydown', {code: 'KeyA', keyCode: 0x41});
                kbd._handleKeyDown(evt);
                var evt = keyevent('keypress', {code: 'KeyA', charCode: 0x41});
                kbd._handleKeyPress(evt);
                expect(evt.preventDefault).to.have.been.called;
            });
        });
    });

    describe('Track Key State', function() {
        it('should send release using the same keysym as the press', function(done) {
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                expect(keysym).to.be.equal(0x61);
                expect(code).to.be.equal('KeyA');
                if (!down) {
                    done();
                }
            }});
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'a'}));
            kbd._handleKeyUp(keyevent('keyup', {code: 'KeyA', key: 'b'}));
        });
        it('should send the same keysym for multiple presses', function() {
            var count = 0;
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                expect(keysym).to.be.equal(0x61);
                expect(code).to.be.equal('KeyA');
                expect(down).to.be.equal(true);
                count++;
            }});
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'a'}));
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'b'}));
            expect(count).to.be.equal(2);
        });
        it('should do nothing on keyup events if no keys are down', function() {
            var callback = sinon.spy();
            var kbd = new Keyboard({onKeyEvent: callback});
            kbd._handleKeyUp(keyevent('keyup', {code: 'KeyA', key: 'a'}));
            expect(callback).to.not.have.been.called;
        });
    });

    describe('Escape Modifiers', function() {
        var origNavigator;
        beforeEach(function () {
            // window.navigator is a protected read-only property in many
            // environments, so we need to redefine it whilst running these
            // tests.
            origNavigator = Object.getOwnPropertyDescriptor(window, "navigator");
            if (origNavigator === undefined) {
                // Object.getOwnPropertyDescriptor() doesn't work
                // properly in any version of IE
                this.skip();
            }

            Object.defineProperty(window, "navigator", {value: {}});
            if (window.navigator.platform !== undefined) {
                // Object.defineProperty() doesn't work properly in old
                // versions of Chrome
                this.skip();
            }

            window.navigator.platform = "Windows x86_64";
        });
        afterEach(function () {
            Object.defineProperty(window, "navigator", origNavigator);
        });

        it('should generate fake undo/redo events on press when a char modifier is down', function() {
            var times_called = 0;
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                switch(times_called++) {
                case 0:
                    expect(keysym).to.be.equal(0xFFE3);
                    expect(code).to.be.equal('ControlLeft');
                    expect(down).to.be.equal(true);
                    break;
                case 1:
                    expect(keysym).to.be.equal(0xFFE9);
                    expect(code).to.be.equal('AltLeft');
                    expect(down).to.be.equal(true);
                    break;
                case 2:
                    expect(keysym).to.be.equal(0xFFE9);
                    expect(code).to.be.equal('Unidentified');
                    expect(down).to.be.equal(false);
                    break;
                case 3:
                    expect(keysym).to.be.equal(0xFFE3);
                    expect(code).to.be.equal('Unidentified');
                    expect(down).to.be.equal(false);
                    break;
                case 4:
                    expect(keysym).to.be.equal(0x61);
                    expect(code).to.be.equal('KeyA');
                    expect(down).to.be.equal(true);
                    break;
                case 5:
                    expect(keysym).to.be.equal(0xFFE9);
                    expect(code).to.be.equal('Unidentified');
                    expect(down).to.be.equal(true);
                    break;
                case 6:
                    expect(keysym).to.be.equal(0xFFE3);
                    expect(code).to.be.equal('Unidentified');
                    expect(down).to.be.equal(true);
                    break;
                }
            }});
            // First the modifier combo
            kbd._handleKeyDown(keyevent('keydown', {code: 'ControlLeft', key: 'Control'}));
            kbd._handleKeyDown(keyevent('keydown', {code: 'AltLeft', key: 'Alt'}));
            // Next a normal character
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'a'}));
            expect(times_called).to.be.equal(7);
        });
        it('should no do anything on key release', function() {
            var times_called = 0;
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                switch(times_called++) {
                case 7:
                    expect(keysym).to.be.equal(0x61);
                    expect(code).to.be.equal('KeyA');
                    expect(down).to.be.equal(false);
                    break;
                }
            }});
            // First the modifier combo
            kbd._handleKeyDown(keyevent('keydown', {code: 'ControlLeft', key: 'Control'}));
            kbd._handleKeyDown(keyevent('keydown', {code: 'AltLeft', key: 'Alt'}));
            // Next a normal character
            kbd._handleKeyDown(keyevent('keydown', {code: 'KeyA', key: 'a'}));
            kbd._handleKeyUp(keyevent('keyup', {code: 'KeyA', key: 'a'}));
            expect(times_called).to.be.equal(8);
        });
        it('should not consider a char modifier to be down on the modifier key itself', function() {
            var times_called = 0;
            var kbd = new Keyboard({
            onKeyEvent: function(keysym, code, down) {
                switch(times_called++) {
                case 0:
                    expect(keysym).to.be.equal(0xFFE3);
                    expect(code).to.be.equal('ControlLeft');
                    expect(down).to.be.equal(true);
                    break;
                case 1:
                    expect(keysym).to.be.equal(0xFFE9);
                    expect(code).to.be.equal('AltLeft');
                    expect(down).to.be.equal(true);
                    break;
                case 2:
                    expect(keysym).to.be.equal(0xFFE3);
                    expect(code).to.be.equal('ControlLeft');
                    expect(down).to.be.equal(true);
                    break;
                }
            }});
            // First the modifier combo
            kbd._handleKeyDown(keyevent('keydown', {code: 'ControlLeft', key: 'Control'}));
            kbd._handleKeyDown(keyevent('keydown', {code: 'AltLeft', key: 'Alt'}));
            // Then one of the keys again
            kbd._handleKeyDown(keyevent('keydown', {code: 'ControlLeft', key: 'Control'}));
            expect(times_called).to.be.equal(3);
        });
    });
});
