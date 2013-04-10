## The Javascript Module for Accessing Rdbhost

## Rdbhost.com is a '''universal backend''', allowing you to write your web application entirely in JavaScript on the
 browser.  This module implements an API for accessing server-side resources in your Rdbhost.com account.

### There are three versions of the library, depending on how you wish to manage the cross-domain data transfer
issues.  I recommend you use the [rdbhost.jquery.exdm.js](/rdbhost/Rdb.Js/blob/master/README.EXDM.md) module,
as it is the easiest to get working quickly.  It is a bit heavy, requiring the easyXDM library, so a CORS-browser
only version is available as well, and a version that depends on you providing a subdomain pointer pointing at our
server. ###

##  Recommended [rdbhost.jquery.exdm.js](/rdbhost/Rdb.Js/blob/master/README.EXDM.md)

### Dependencies ###
This module requires jQuery.  Version 1.9 or greater is recommended.
Use with Internet Explorer 7 requires json2.js also.
