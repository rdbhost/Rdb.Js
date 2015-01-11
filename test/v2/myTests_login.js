
/*
*
* tests for the SQLEngine
*
*
*/



var passwd;


module('Login Test');

// create Login object, and login with it
asyncTest('login ', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    passwd = passwd || prompt('enter password for '+demo_email);
    var p = e.login(demo_email, passwd);
    p.then(function(resp) {
            ok(resp, 'data received');
            ok(resp.role.substr(0,1).toLowerCase() === 's', 'bad role found');
            ok(resp.authcode.length > 20, 'bad authcode found');
            var ac = e.authcode();
            ok(ac.length>20, 'authcode bad '+ac);
            start();
        })
        .catch(function(err) {
            ok(false, 'catch should not be called '+err);
            start();
        })
});


// create Login object, and fail at logging in
asyncTest('login fail', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    var p = e.login(demo_email, 'not-pw');
    p.then(function(resp) {
         ok(false, 'data received');
         start();
     })
     .catch(function(err) {
        ok(err, 'login failed '+err);
        start();
     })
});

// create Login object, login, and test for delayed loss of authcode
asyncTest('login timeout', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    passwd = passwd || prompt('enter password for '+demo_email);
    var p = e.login(demo_email, passwd);
    p.delay(10000).then(function(resp) {
            ok(resp, 'data received');
            ok(resp.role.substr(0,1).toLowerCase() === 's', 'bad role found');
            ok(resp.authcode.length > 20, 'bad authcode found');
            var ac = e.authcode();
            ok(!ac, 'authcode bad '+ac);
            start();
        })
        .catch(function(err) {
            ok(false, 'catch should not be called '+err);
            start();
        })
});


// create Login object, load login form
asyncTest('login form submit', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    var p = e.emailPasswdForm();
    p.then(function(epTuple) {
            ok(epTuple, 'data received');
            var email = epTuple[0], passwd = epTuple[1];
            ok(email && email.length>1, 'email provided '+email);
            ok(passwd && passwd.length>1, 'passwd provided '+passwd);
            start();
        })
        .catch(function(err) {
            ok(false, 'catch should not be called '+err);
            start();
        });

    setTimeout(function() {
        var div = document.getElementById('rdbhost-super-login-form');
        var inputs = div.getElementsByTagName('input');
        inputs.email.value = 'hello';
        inputs.password.value = 'sesame';
        var submitBtn = document.getElementById('rslf-submit');
        submitBtn.click();
    }, 300);
});

// create Login object, load login form
asyncTest('login form cancel', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    var p = e.emailPasswdForm();
    p.then(function(html) {
            ok(false, 'data received');
            start();
        })
        .error(function(err) {
            ok(true, 'cancellation error caught');
            start();
        })
        .catch(function(err) {
            ok(false, 'catch should not be called '+err);
            start();
        });

    setTimeout(function() {
        var cancelBtn = document.getElementById('rslf-cancel');
        cancelBtn.click();
    }, 300);
});

// create Login object, load login form
asyncTest('login form emailCaching', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    var p = e.emailPasswdForm();
    p.then(function(epTuple) {
            ok(epTuple, 'data received');
            var email = epTuple[0];
            ok(email && email.length>1, 'email provided '+email);

            var p1 = e.emailPasswdForm();
            p1.then(function(ept) {
                    ok(ept, 'data received');
                    var email = ept[0], passwd = ept[1];
                    ok(email && email === 'hello', 'email populated to form');
                    ok(passwd === '', 'password not populated to form');
                    start();
                })
                .catch(function(err) {
                    ok(false, 'catch should not be called '+err);
                    start();
                });

            setTimeout(function() {
                var submitBtn = document.getElementById('rslf-submit');
                submitBtn.click();
            }, 150);
        })
        .catch(function(err) {
            ok(false, 'catch should not be called '+err);
            start();
        });

    setTimeout(function() {
        var div = document.getElementById('rdbhost-super-login-form');
        var inputs = div.getElementsByTagName('input');
        inputs.email.value = 'hello';
        inputs.password.value = 'sesame';
        var submitBtn = document.getElementById('rslf-submit');
        submitBtn.click();
    }, 150);
});



// create Login object, load login form
asyncTest('login by form - fail', function() {

    var e = RdbhostLogin({'accountId': acct_number});
    var p = e.loginByForm();
    p.then(function() {
            ok(false, 'success function should not be called');
            start();
        })
        .catch(function(err) {
            ok(true, 'login failed '+err);
            start();
        });

    setTimeout(function() {
        var div = document.getElementById('rdbhost-super-login-form');
        var inputs = div.getElementsByTagName('input');
        inputs.email.value = 'hello';
        inputs.password.value = 'sesame';
        var submitBtn = document.getElementById('rslf-submit');
        submitBtn.click();
    }, 300);
});



// create Login object, load login form
asyncTest('login by form - ok', function() {

    passwd = passwd || prompt('enter password for '+demo_email);

    var e = RdbhostLogin({'accountId': acct_number});
    var p = e.loginByForm();
    p.then(function(res) {
            ok(res, 'results received');
            ok(res.role === demo_s_role, 'super role received');
            ok(res.authcode.length > 25, 'authcode received');
            start();
        })
        .catch(function(err) {
            ok(false, 'catch should not be called '+err);
            start();
        });

    setTimeout(function() {
        var div = document.getElementById('rdbhost-super-login-form');
        var inputs = div.getElementsByTagName('input');
        inputs.email.value = demo_email;
        inputs.password.value = passwd;
        var submitBtn = document.getElementById('rslf-submit');
        submitBtn.click();
    }, 300);
});



/*
*
*/
