
/*
 *  wraps a Q deferred object to make it behave like a jQuery .Deferred object.
 *
 *    implements these methods only:
 *      reject, resolve, then, promise
 */


(function($, Q) {

    function altDef() {

        var qDef = new Q.defer();

        return {

            resolve: function(m) {
                return qDef.resolve(m);
            },

            reject: function(r) {
                return qDef.reject(r);
            },

            then: function(s, f) {
                return qDef.promise.then(s, f);
            },

            promise: function() {
                return qDef.promise;
            }
        }
    }

    window.$.Deferred = altDef;

})(window.Zepto, Q);