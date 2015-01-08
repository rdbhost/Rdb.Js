
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


asyncTest('simple send', function() {

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

asyncTest('simple send - queued', function() {

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


asyncTest('simple send - fail', function() {

    var e = RdbhostConnection({'accountId': acct_number, 'roleType': 'r'});
    ok(e.readyState() === 0, 'Bad ReadyState ' + e.readyState());

    setTimeout(function() {

        var p = e.execute({'q': 'SELCT 3 AS three'});
        ok(p, 'Promise not Null '+ p);
        p.catch(function(msg) {
            err = msg['error'];
            ok(err[0] === '42601', 'errback called ' + err[0] + ' ' + err[1]);
            e.close();
            start();
        });
        p.then(function(resp) {
            ok(false, 'bad response');
            e.close();
            start();
        });
    }, 1000);

});


/*
*
*/
