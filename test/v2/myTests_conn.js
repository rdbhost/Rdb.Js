
/*
*
* tests for the SQLEngine
*
*
*/


module('Connection Pre-test');

// create connection
asyncTest('create Connection', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    setTimeout(function() {
        ok(e, 'Connection created');
        ok(e.execute, 'Connection has execute attribute');
        ok(e.readyState() > 0, 'Bad ReadyState ' + e.readyState());
        start();
        e.close();
    }, 1000);
});

/*

// create connection-fail
asyncTest('create Connection Fail', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r', 'host': 'example.com'});
    setTimeout(function() {
        ok(e, 'Connection created');
        ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());
        ok(e.execute, 'Connection has execute attribute');
        start();
        e.close();
    }, 1000)
});

*/


asyncTest('simple ws', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    setTimeout(function() {

        var p = e.execute({'q': 'SELECT 1 AS one'});
        ok(p, 'Promise Not Null '+ p);
        p.catch(function(err) {
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        });
        p.then(function(resp) {
            ok(resp, 'ok');
            ok(resp.status[1].toLowerCase() == 'ok', 'status not ok '+ resp.status[1]);
            ok(resp.row_count[0] > 0, 'data row found');
            ok(resp.records.rows[0]['one'] === 1, 'data is ' + resp.records.rows[0]['one']);
            e.close();
            start();
        });
    }, 1000);

});

asyncTest('simple ws - queued', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var p = e.execute({'q': 'SELECT 2 AS two'});
    ok(p, 'Promise Not Null '+ p);
    p.catch(function(err) {
        ok(false, 'errback called ' + err[0] + ' ' + err[1]);
        e.close();
        start();
    });
    p.then(function(resp) {
        ok(resp, 'ok');
        ok(resp.status[1].toLowerCase() == 'ok', 'status not ok '+ resp.status[1]);
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['two'] === 2, 'data is ' + resp.records.rows[0]['two']);
        e.close();
        start();
    });
});


asyncTest('simple ws - args', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var p = e.execute({'q': 'SELECT %s AS two', args: [2]});
    ok(p, 'Promise Not Null '+ p);
    p.catch(function(err) {
        ok(false, 'errback called ' + err[0] + ' ' + err[1]);
        e.close();
        start();
    });
    p.then(function(resp) {
        ok(resp, 'ok');
        ok(resp.status[1].toLowerCase() == 'ok', 'status not ok '+ resp.status[1]);
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['two'] === 2, 'data is ' + resp.records.rows[0]['two']);
        e.close();
        start();
    });
});


asyncTest('simple ws - namedParams', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var p = e.execute({'q': 'SELECT %(two)s AS two', namedParams: {'two': 2}});
    ok(p, 'Promise Not Null '+ p);
    p.catch(function(err) {
        ok(false, 'errback called ' + err[0] + ' ' + err[1]);
        e.close();
        start();
    });
    p.then(function(resp) {
        ok(resp, 'ok');
        ok(resp.status[1].toLowerCase() == 'ok', 'status not ok '+ resp.status[1]);
        ok(resp.row_count[0] > 0, 'data row found');
        ok(resp.records.rows[0]['two'] === 2, 'data is ' + resp.records.rows[0]['two']);
        e.close();
        start();
    });
});


asyncTest('simple ws - fail', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    setTimeout(function() {

        var p = e.execute({'q': 'SELCT 3 AS three'});
        ok(p, 'Promise not Null '+ p);
        p.then(function(resp) {
                ok(false, 'bad response');
                e.close();
                start();
            })
            .error(function(err){
                ok(err[0] === '42601', 'errback called ' + err[0] + ' ' + err[1]);
                e.close();
                start();
            })
            .catch(function(err) {
                var a = 1;
                return err;
            });
    }, 1000);

});


asyncTest('simple xhr', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var fD = new FormData();
    var p = e.execute({'q': 'SELECT 3 AS three', 'form': fD});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(resp['status'][1].toLowerCase() === 'ok', 'bad response status ' + resp['status'][1]);
            e.close();
            start();
        })
        .error(function(err) {
            // err = msg['error'];
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function() {
            ok(f, 'catch shouldnt be called');
            start();
        })
});


asyncTest('simple xhr - fail', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var fD = new FormData();
    var p = e.execute({'q': 'SELCT 4 AS four', 'form': fD});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(false, 'bad response');
            e.close();
            start();
        })
        .error(function(err) {
            // err = msg['error'];
            ok(err[0] === '42601', 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function(err) {
            ok(false, 'catch shouldnt be called');
            e.close();
            start();
        })
});


asyncTest('simple xhr - args', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var fD = new FormData();
    var p = e.execute({'q': 'SELECT %s AS four, %s as fruit', 'form': fD, 'args': [4, 'BANANA']});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(resp['status'][1].toLowerCase() === 'ok', 'bad response status ' + resp['status'][1]);
            ok(resp.row_count[0] > 0, 'data row found');
            ok(parseInt(resp.records.rows[0]['four'], 10) === 4, 'data is ' + resp.records.rows[0]['four']);
            ok(resp.records.rows[0]['fruit'] === 'BANANA', 'data is ' + resp.records.rows[0]['fruit']);
            e.close();
            start();
        })
        .error(function(err) {
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function() {
            ok(false, 'catch shouldnt be called');
            e.close();
            start();
        })
});


asyncTest('simple xhr - namedParams', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var fD = new FormData();
    var p = e.execute({'q': 'SELECT %(_four)s AS four, %(_fruit)s as fruit',
                       'form': fD, 'namedParams': {'_four': 4, '_fruit': 'PEAR'}});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(resp['status'][1].toLowerCase() === 'ok', 'bad response status ' + resp['status'][1]);
            ok(resp.row_count[0] > 0, 'data row found');
            ok(parseInt(resp.records.rows[0]['four'], 10) === 4, 'data is ' + resp.records.rows[0]['four']);
            ok(resp.records.rows[0]['fruit'] === 'PEAR', 'data is ' + resp.records.rows[0]['fruit']);
            e.close();
            start();
        })
        .error(function(err) {
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function() {
            ok(false, 'catch shouldnt be called');
            e.close();
            start();
        })
});

// do SELECT query form way
var form = "<form id=\"qunit_form\" method='post' enctype=\"multipart/form-data\">"+
    "<input name=\"arg000\" value=\"99\" />"+
    "</form>";

module('Form tests', {

    setup: function () {
        var f = document.getElementById('qunit_form');
        if (f)
            document.body.removeChild(f);
        document.body.insertAdjacentHTML('beforeend', form);
    },

    teardown: function () {

        var f = document.getElementById('qunit_form');
        if (f)
            document.body.removeChild(f);
    }
});


asyncTest('simple xhr - form', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    var f = document.getElementById('qunit_form');
    var p = e.execute({'q': 'SELECT %s AS four', 'form': f});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(resp['status'][1].toLowerCase() === 'ok', 'bad response status ' + resp['status'][1]);
            ok(resp.row_count[0] > 0, 'data row found');
            ok(parseInt(resp.records.rows[0]['four'], 10) === 99, 'data is ' + resp.records.rows[0]['four']);
            e.close();
            start();
        })
        .error(function(err) {
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function() {
            ok(false, 'catch shouldnt be called');
            e.close();
            start();
        })
});


module('errorHandler tests');

asyncTest('simple xhr - errorHandler emit', 4, function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());
    e.onError('all', function(msg) {
       ok(msg, 'onError handler called');
    });

    var fD = new FormData();
    var p = e.execute({'q': 'SELCT 4 AS four', 'form': fD});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(false, 'bad response');
            e.close();
            start();
        })
        .error(function(err) {
            // err = msg['error'];
            ok(err[0] === '42601', 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function(err) {
            ok(false, 'catch shouldnt be called');
            e.close();
            start();
        })
});


asyncTest('simple ws - errorHandler emit', 4, function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());
    e.onError('all', function(msg) {
        ok(msg, 'onError handler called');
    });

    var p = e.execute({'q': 'SELCT 3 AS three'});
    ok(p, 'Promise not Null '+ p);
    p.then(function() {
            ok(false, 'bad response');
            e.close();
            start();
        })
        .error(function(err){
            ok(err[0] === '42601', 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function(err) {
            var a = 1;
            return err;
        });

});


asyncTest('simple xhr - errorHandler silent', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());
    e.onError('all', function(msg) {
        ok(false, 'onError handler called');
    });

    var fD = new FormData();
    var p = e.execute({'q': 'SELECT 4 AS four', 'form': fD});
    ok(p, 'Promise not Null ' + p);
    p.then(function(resp) {
            ok(resp, 'bad response');
            e.close();
            start();
        })
        .error(function(err) {
            // err = msg['error'];
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function(err) {
            ok(false, 'catch shouldnt be called');
            e.close();
            start();
        })
});


asyncTest('simple ws - errorHandler silent', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());
    e.onError('all', function(msg) {
        ok(false, 'onError handler called');
    });

    var p = e.execute({'q': 'SELECT 3 AS three'});
    ok(p, 'Promise not Null '+ p);
    p.then(function(resp) {
            ok(resp, 'bad response');
            e.close();
            start();
        })
        .error(function(err){
            ok(false, 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        })
        .catch(function(err) {
            return err;
        });

});


/*
module('Login Test');

// create connection
asyncTest('login ', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'}),
        pw = prompt('enter password for '+demo_email);
    var p = e.login(demo_email, pw);
    p.then(function(resp) {
        ok(resp, 'data received');
        ok(resp.role.substr(0,1).toLowerCase() === 's', 'bad role found');
        ok(resp.authcode.length > 20, 'bad authcode found');
        start();
    })
        .catch(function(err) {
            ok(false, 'catch should not be called');
            start();
        })
});


 // create connection
 asyncTest('login fail', function() {

 var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
 var p = e.login(demo_email, 'not-pw');
 p.then(function(resp) {
 ok(false, 'data received');
 start();
 })
 .catch(function(err) {
 ok(err, 'login failed');
 start();
 })
 });
 */



/*
*
*/
