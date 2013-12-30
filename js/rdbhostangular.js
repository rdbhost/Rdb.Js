/**
 * Created by David on 10/26/13.
 */

'use strict';


if ( ! 'Rdbhost' in window )
    window.Rdbhost = {};

var rdbhostMod = angular.module('rdbhost', ['ngResource']);



rdbhostMod.config(['$httpProvider', function($httpProvider) {


    // Use x-www-form-urlencoded Content-Type
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    // add useXDomain header
    $httpProvider.defaults.useXDomain = true;

/*
    // Remove X-Requested-With header to avoid browser making OPTIONS request
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
*/
    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [function(data) {

        return angular.isObject(data) && String(data) !== '[object File]' ? $.param(data) : data;
    }];
}]);


/*
 *  rdbHttp is a drop-in replacement for Angular's $http, when hosting on Rdbhost.
 *
 *  You can use $http directly, but some errors are reported through the success callback.  Using
 *    rdbHttp directs all errors through the error handler.
 */
rdbhostMod.factory('rdbHttp', ['$http', '$q', function($http, $q) {

    function http_decorated(qPromise, cfg) {

        // these two methods copied from angular.js
        // they add success and error callbacks to generic promise
        qPromise.success = function(fn) {
            qPromise.then(function(response) {
                fn(response.data, response.status, response.headers, cfg);
            });
            return qPromise;
        };

        qPromise.error = function(fn) {
            qPromise.then(null, function(response) {
                fn(response.data, response.status, response.headers, cfg);
            });
            return qPromise;
        };

        return qPromise;
    }

    function rdbhttp(opts) {

        var q = $q.defer(),
            p = $http(opts);

        p.success(function (resp, status, headers, config) {

            // need to feed response to error( ) even if error is communicated in status field
            if ( resp.status[0] === 'error' ) {

                q.reject({ data: resp, status: status, headers: headers, config: config});
            }
            else {

                q.resolve({ data: resp, status: status, headers: headers, config: config});
            }
        });

        p.error(function (data, status, headers, config) {

            q.reject({ data: data, status: status, headers: headers, config: config});
        });

        return http_decorated(q.promise, opts);
    }

    rdbhttp.post = function( url, data, cfg ) {

        cfg = cfg || {};
        cfg.method = 'POST';
        cfg.data = data;
        cfg.url = url;

        return rdbhttp(cfg);
    };

    rdbhttp.get = function( url, cfg ) {

        cfg = cfg || {};
        cfg.method = 'GET';
        cfg.url = url;

        return rdbhttp(cfg);
    };

    rdbhttp.jsonp = rdbhttp.head = rdbhttp.delete =
        rdbhttp.remove = rdbhttp.put = function() { throw new Error('not implemented') };

    // provide decorated function to caller
    return rdbhttp;
}]);

/*
 *  rdbhostTransformResponseFactory creates a function for filtering Rdbhost's response, so
 *    the data provided by the rdbResource is a simple object or array of objects, as you
 *    probably expect.
 *    Used by rdbResource (our substitute for $resource), but you can use it directly.
 */
rdbhostMod.factory('rdbhostTransformResponseFactory', function() {

    return function(isArray) {

        return function(data, headerGetter) {

            data = JSON.parse(data);

            if ( data.status[0] === 'error' )
                throw new Error(data.error);

            if ( data.status[0] !== 'error' && data.records && data.records.rows )
                return isArray ? data.records.rows  : data.records.rows[0];
            else
                return isArray ? [] : {};
        }
    }
});


/*
 *  rdbhostTransformRequest is a function for filtering Rdbhost's requests, so
 *    the data provided to Rdbhost server is what Rdbhost expects.
 *    Used by rdbResource (our substitute for $resource), but you can use it directly with $resource
 *    if you like.
 */
rdbhostMod.factory('rdbhostTransformRequest', function() {

    return function(data, headerGetter) {

        if ( data && typeof(data) === 'object' ) {

            var rdbData = {};
            angular.forEach(data, function(v, k) {

                if (k.substring(0,1) === '$')
                    return;
                if (typeof(v) === 'function')
                    return;
                rdbData['arg:'+k] = v;
            });

            return angular.isObject(rdbData) && String(rdbData) !== '[object File]' ? $.param(rdbData) : rdbData;
        }
        else {
            return '';
        }
    }
});


/* Services */

/*
 *   rdbResource is a replacement for $resource, when working with the Rdbhost service.
 *
 *     It works the same as $resource, with the same argument list, and the same behavior.  Returned
 *       objects have $save, etc. methods for writing back to the server.
 *
 *     Caveats:
 *       If you use a transformResponse function in your actions, it should return Javascript Objects,
 *         not serialized.  The rdbResource final transformation will serialize for you.
 *       The action list is the only required parameter, and each action must have a 'q' attribute in the
 *         params attribute.  It may also have namedParams or args attributes.
 *
 *       If paramDefault is not provided, or does not contain an Rdbhost userName and domain, those
 *         values will be retrieved from the R.rdbHostConfig.opts hash.
 */

rdbhostMod.factory('rdbResource', ['$resource', 'rdbhostTransformResponseFactory', 'rdbhostTransformRequest',
                            function($resource, rdbhostTransformResponseFactory, rdbhostTransformRequest) {

    var R = window.Rdbhost;

    return function(url, paramDefaults, actions) {

        if ( typeof(url) !== typeof('') ) {

            actions = paramDefaults;
            paramDefaults = url;
            url = 'https://:domain/db/:userName';
        }

        if ( ! actions ) {
            actions = paramDefaults;
            paramDefaults = {};
        }

        if ( ! paramDefaults.userName )
            paramDefaults.userName = 'p' + ('000000000' + $.rdbHostConfig.opts.accountNumber).substr(-10);
        if ( ! paramDefaults.domain )
            paramDefaults.domain = R.rdbHostConfig.opts.domain;

        angular.forEach(actions, function(v, k) {

            v.method = v.method || 'GET';
            v.params.format = 'json-easy';

            if (v.params.namedParams) {
                var orig_namedParams = v.params.namedParams;
                delete v.params.args;

                angular.forEach(orig_namedParams, function(val, k) {

                    v.params['arg:'+k] = val;
                });
            }

            if (v.params.args) {
                var orig_args = v.params.args;
                delete v.params.args;

                angular.forEach(orig_args, function(val, i) {

                    var key = ('000'+i).slice(-3);
                    v.params['arg'+ key] = val;
                });
            }

            if (!v.transformRequest)
                v.transformRequest = [];
            else if (typeof(v.transformRequest) === 'function')
                v.transformRequest = [v.transformRequest];
            else if (typeof(v.transformRequest) !== typeof([]))
                throw new Error('bad transformRequest type ' + typeof(v.transformRequest));

            v.transformRequest.push(rdbhostTransformRequest);

            if (!v.transformResponse)
                v.transformResponse = [];
            else if (typeof(v.transformResponse) === 'function')
                v.transformResponse = [v.transformResponse];
            else if (typeof(v.transformResponse) !== typeof([]))
                throw new Error('bad transformResponse type ' + typeof(v.transformResponse));

            v.transformResponse.push(rdbhostTransformResponseFactory(v.isArray))
        });

        return $resource(url, paramDefaults, actions);
    }
}]);

