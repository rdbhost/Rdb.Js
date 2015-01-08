
/*
*
* tests for rdbhost-angular.js
*
*/

var R = window.Rdbhost;

var injector = angular.injector(['ng', 'rdbhost']);

module('rdbhost-angular rdbHttp tests', {
    setup: function() {
        this.$scope = injector.get('$rootScope').$new();

        $.rdbHostConfig({
           userName: 'reader',
           domain: 'www.rdbhost.com',
           accountNumber: 12
        });
    }
});


asyncTest('rdbHttp', 1, function() {

    var ajax = injector.get('rdbHttp'),
        p = ajax({
            url: 'https://' + R.rdbHostConfig.opts.domain + '/db/' + R.role(),
            params: {
                q: 'SELECT 2 AS two',
                format: 'json-easy'
            },
            method: 'GET'
        });
        p.success(function(resp, status, headers, cfg) {
            var v = resp.records.rows[0].two;
            ok(v === 2, 'success');
            start()
        });
        p.error(function(resp, status, header, cfg) {
            ok(false, 'error ' + err);
            start()
        });
});


asyncTest('rdbHttp + args', 1, function() {

    var ajax = injector.get('rdbHttp'),
        p = ajax({
            url: 'https://' + R.rdbHostConfig.opts.domain + '/db/' + R.role(),
            params: {
                q: 'SELECT %s::INTEGER + %s::INTEGER AS sum',
                format: 'json-easy',
                arg000: 1,
                arg001: 2
            },
            method: 'GET'
        });
    p.success(function(resp, status, headers, cfg) {
        var v = resp.records.rows[0].sum;
        ok(v === 3, 'success');
        start()
    });
    p.error(function(resp, status, header, cfg) {
        ok(false, 'error ' + status + ' ' + resp.status);
        start()
    });
});


module('rdbhost-angular rdbResource tests', {

    remote_test_table_setup: false,

    setup: function() {
        this.$scope = injector.get('$rootScope').$new();
        var _this = this;

        R.rdbHostConfig({
            userName: 'preauth',
            domain: 'www.rdbhost.com',
            accountNumber: 12
        });

        if ( ! _this.remote_test_table_setup ) {

            var ajax = injector.get('rdbHttp'),
                p = ajax({
                    url: 'https://' + R.rdbHostConfig.opts.domain + '/db/' + R.role(),
                    params: {
                        q: 'INSERT INTO angular.test (owner, count) VALUES(%[REMOTE_ADDR], 0)',
                        format: 'json-easy'
                    },
                    method: 'GET'
                });
            p.success(function(resp, status, headers, cfg) {
                _this.remote_test_table_setup = true;
            });
            p.error(function(resp, status, header, cfg) {
                if (resp.error[0] !== '23505')
                    ok(false, 'error in setup ' + resp.error)
            });
        }
    }
});


asyncTest('rdbResource', 1, function() {
    var resource = injector.get('rdbResource'),
        res = resource(
            {
                userName: R.role()
            },
            {
                get: {
                    params: {
                        q: 'SELECT 1 as one'
                    }
                }
            }
        ),
        r = res.get(
            function(json) {
                ok(json['one'] === 1, 'success');
                start()
            },
            function(err) {
                ok(false, 'error ' + err);
                start()
            }
        );
});


asyncTest('rdbResource + args', 1, function() {
    var resource = injector.get('rdbResource'),
        res = resource(
            {
                userName: R.role()
            },
            {
                get: {
                    params: {
                        q: 'SELECT %s::INTEGER + %s::INTEGER as sum',
                        args: [1, 2]
                    }
                }
            }
        ),
        r = res.get(
            function(json) {
                ok(json['sum'] === 1+2, 'success');
                start()
            },
            function(err) {
                ok(false, 'error ' + err);
                start()
            }
        );
});


asyncTest('rdbResource + namedParams', 1, function() {

    var resource = injector.get('rdbResource'),
        res = resource(
            {
                userName: R.role()
            },
            {
                get: {
                    params: {
                        q: 'SELECT %(first)::INTEGER + %(second)::INTEGER as sum',
                        namedParams: {
                            first: 1,
                            second: 2
                        }
                    }
                }
            }
        ),
        r = res.get(
            function(json) {
                ok(json['sum'] === 1+2, 'success');
                start()
            },
            function(err) {
                ok(false, 'error ' + err);
                start()
            }
        );
});


asyncTest('rdbResource + lifecycle', 3, function() {

    var resource = injector.get('rdbResource'),
        res = resource(
            {
                userName: R.role()
            },
            {
                get: {
                    params: {
                        q: 'SELECT owner, count FROM angular.test WHERE owner = %[REMOTE_ADDR]'
                    }
                },

                update: {
                    method: 'POST',
                    params: {
                        q: 'UPDATE angular.test SET count = %(count) WHERE owner = %[REMOTE_ADDR]' //,
                        // namedParams: {
                        //    count: '@count'
                        //}
                    }
                }
            }

        ),
        r = res.get(
            function(json) {
                var count = json.count;
                ok(json.$update, 'has $update');
                json.count = count + 1;
                json.$update();

                res.get(
                  function(json2) {
                      ok(json2.$update(), 'has $update');
                      ok(json2.count === count+1, 'good count ' + json2.count + ' ' + (count+1));

                      start()
                  },
                  function(err) {
                      ok(false, 'bad $update');
                      start()
                  }
                );

            },
            function(err) {
                ok(false, 'error ' + err);
                start()
            }
        );
});




/*
 *
 */
