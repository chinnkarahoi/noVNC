// NB: this should *not* be included as a module until we have
// native support in the browsers, so that our error handler
// can catch script-loading errors.


(function(){
    "use strict";

    function convertNewlines(msg, parentElem) {
        const lines = msg.split("\n");
        lines.forEach(function (line) {
            parentElem.appendChild(document.createElement("br"));
            parentElem.appendChild(document.createTextNode(line));
        });
        parentElem.removeChild(parentElem.firstChild);
        return parentElem;
    }

    // Fallback for all uncought errors
    function handleError (event, err) {
        try {
            const msg = document.getElementById('noVNC_fallback_errormsg');

            // Only show the initial error
            if (msg.hasChildNodes()) {
                return false;
            }

            var div = document.createElement("div");
            div.classList.add('noVNC_message');
            convertNewlines(event.message, div);
            msg.appendChild(div);

            if (event.filename !== undefined && event.lineno !== undefined && event.colno !== undefined) {
                div = document.createElement("div");
                div.className = 'noVNC_location';
                    const text = event.filename + ":" + event.lineno + ":" + event.colno;
                    div.appendChild(document.createTextNode(text));
                msg.appendChild(div);
            }

            if ((err !== undefined) &&
                (err.stack !== undefined)) {
                div = document.createElement("div");
                div.className = 'noVNC_stack';
                div.appendChild(document.createTextNode(err.stack));
                msg.appendChild(div);
            }

            document.getElementById('noVNC_fallback_error')
                .classList.add("noVNC_open");
        } catch (exc) {
            document.write("noVNC encountered an error.");
        }
        // Don't return true since this would prevent the error
        // from being printed to the browser console.
        return false;
    }
    window.addEventListener('error', function (evt) { handleError(evt, evt.error); });
    window.addEventListener('unhandledrejection', function (evt) { handleError(evt.reason, evt.reason); });
})();
