/*

  jquery.rdbhost.subdomain.js

  A jquery plugin to access PostgreSQL databases on Rdbhost.com

  requires a (free) account at www.rdbhost.com to be useful.

  this module includes a class 'SQLEngine' for the database connection, and
    that class can be used by itself, aside from the plugins.  jQuery 1.4+
    is required, even when using the connection class without the plugin.


  the module adds four functions and three methods to the jQuery namespace.

  The four functions are $.rdbHostConfig, $.withResults, $.eachRecord, and
    $.postFormData.  The three methods are $.fn.populateTable,
    $.fn.populateForm, and $.fn.datadump.  There is also a $.postData alias
    to $.withResults

  $.rdbHostConfig takes an options object, and makes those options default for
    all subsequent functions and methods.

  $.withResults sends a query to the server, receives the data, and calls
    a callback with the received data.

  $.eachRecord is like $.withResults, in that it gets data from the server,
    but it extracts the rows from the data structure, and calls an eachrec
    callback for each record.  Each record is a javascript object, with a
    named attribute for each field.

  $.postFormData takes a form as input, submits that form to the server,
    receives the data returned, and provides it to the callback.
    The form fields must conform to the rdbhost protocol.

  $.postData posts to the server, receives the data returned, and provides it
    to the callback.  Similar to jQuery's $.ajax()

  $.loginOpenId provides various services related to OpenID logins.  It will
    prep the form prior to submission, and handles hash values and cookies
    upon return from login process.  Call it in both the openId submit form,
    and in the follow up form.

  Form fields
    The form *must* include either a 'q' or a 'kw' field.  It may also include
     'arg###', or 'argtype###' fields.  Argument fields are numbered like
     'arg000', 'arg001'... in order.  Argument type fields, 'argtype000'..,
     if provided, must correspond to arg fields. Argument fields may be file
     fields.

	  The 'kw' field value allows you to invoke a query that is stored in the
	   'lookup.queries' table on the  server.  See website documentation for
	   details.

    $.fn.populateTable sends a query to the server, receives the data, and populates
      an html table with it.  If the element provided is not a table, a new
      table is inserted in it; if the element is an empty table, it is expanded
      with new rows, one per record, and if the table has a prototype row, that
      row is duplicated once per record, and the record data is placed in
      td elements based on class name matches. (a field named 'firstName' would
      put its value in a table cell like '<td class="firstName">').  A cell
      can have multiple classes, so adding field-name classes should not interfere
      with styling.

    $.fn.populateForm sends a query to the server, receives the data, selects the
      first record, and populates a form with it.  It attempts to match each field
      name to an input field with matching id, and then attempts to match an input
      field with matching class-name.

    $.fn.datadump is a diagnostic-aid that puts a formatted json-string of
      the data into the selected html elements.  It allows you to verify the
      data retrieval functionality before doing (much) html work.

*/


/*
  logging
*/
function consoleLog(msg) {
  window.console.log(msg);
}


// SQL Engine that uses form for input, and hidden iframe for response
//   handles file fields
//
function SQLEngine(userName, authcode, domain)
{
	// store engine config info
  var remote = 'http://'+domain,
	    format = 'jsond';

	// to add hidden field to form
	function add_hidden_field($form,nm,val) {

		var fld = $('<input type="hidden" class="hidden-field-auto" />');
		fld.attr('name',nm).val(val);
		$form.append(fld);
	}

	// delay before removing iframe, workaround for ff 'busy' bug.
	function remove_iframe(ttag) {

    setTimeout(function() { $('#'+ttag).remove(); }, 1);
	}


  /*
   Return API type for data item.

   return value is one of STRING, NUMBER, DATE, NONE, DATETIME, TIME
   */
  function apiType(d) {

    switch (typeof d) {

      case 'number':
        return 'NUMBER';
      case 'object':
        if ($.type(d) == 'date')
          return 'DATETIME';
        else
          return 'STRING';
      case 'undefined':
        return 'NONE';

      default:
        return 'STRING'
    }
  }


  this.getQueryUrl = function (altPath) {
    if (altPath === undefined) {
      altPath = '/db/' + userName;
    }
    return remote + altPath;
  };

  this.getLoginUrl = function() {

		return this.getQueryUrl('/mbr/jslogin');
	};

	this.getCommonDomain = function() {

		var hparts = window.location.hostname.split('.').slice(-2);

		return hparts.join('.');
	};


  /*
  parms is object containing various options

   callback : function to call with data from successful query
   errback : function to call with error object from query failure
   q : the query string itself
   args : array of arguments (optional), must correspond with %s tokens
      in query
   namedParams : object with names values
   plainTextJson : true if JSON parsing to be skipped, in lieu of
      returning the JSON plaintext
   format : 'jsond' or 'jsond-easy'
   */
	this.query = function(parms) {

    parms.format = parms.format || format;
    parms.args = parms.args || [];
    parms.namedParams = parms.namedParams || {};

    var errback = parms.errback,
        iframe_requested = false,
		    that = this,
		    formId = 'rdb_hidden_form_'+(SQLEngine.formnamectr+=1),
        defer = $.Deferred();

		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}

    // attach success and fail handlers to promise
    if (parms.callback)
      defer.done(parms.callback);
    defer.fail(errback);

		// local callbacks to do cleanup prior to 'real' callback
		function qErrback(err,msg) {

		  // if frame loaded by 'back button', skip over it
			if (!iframe_requested) {
				parent.history.back();
			}

      iframe_requested = false;
			$hiddenform.remove();
			defer.reject(err,msg);
		}

		function qCallback(json) {

			// if frame loaded by 'back button', skip over it
			if (!iframe_requested) {
				parent.history.back();
			}

      iframe_requested = false;
			$hiddenform.remove();
			defer.resolve(json);
		}

		// create hidden form if necessary
    var $hiddenform = $('#'+formId);

    if ( $hiddenform.length < 1 ) {

				var $newform = $(('<form method="post" name="~~id~~" id="~~id~~"'+
							  ' enctype="multipart/form-data" style="display:none">'+
							  ' </form>').replace(/~~id~~/g,formId));
			  $('body').append($newform);
			  $hiddenform = $('#'+formId);
		}

		// put query in hidden form
		add_hidden_field($hiddenform,'q',parms.q);

    if (parms.kw)
  		add_hidden_field($hiddenform,'kw',parms.kw);

		// if params are provided, convert to named form 'arg000', 'arg001'...
    var num, nm, typNm;
    if ( parms.args !== undefined ) {

      for ( var i=0; i<parms.args.length; i+=1 ) {

        num = '000'+i;
        nm = 'arg'+num.substr(num.length-3);
        add_hidden_field($hiddenform,nm,parms.args[i]);
        typNm = 'argtype' + num.substr(num.length - 3);
        add_hidden_field($hiddenform,typNm,apiType(parms.args[i]));
      }
    }

    if (parms.namedParams !== undefined) {

      // if named params provided
      $.each(parms.namedParams, function (k,v) {

        nm = 'arg:'+k;
        add_hidden_field($hiddenform,nm,v);
        typNm = 'argtype:' + k;
        add_hidden_field($hiddenform,typNm,apiType(v));
      });
    }

		// remove submit handler, if one already, and bind new handler
		$hiddenform.unbind('submit');

    $hiddenform.submit(function (ev) {

      ev.stopPropagation();
      iframe_requested = true;

      var defr = that.queryByForm({
        'formId' : formId,
        'callback' : qCallback,
        'errback' : qErrback,
        'format' : parms.format,
        'plainTextJson' : parms.plainTextJson
      });

      defr.done(defer.resolve);
      defr.fail(defer.fail);
    });

    // submit the hidden form
		$hiddenform.submit();

    return defer;
	};


  /*
  parms is just like for query method, but callback gets row array and
   header array, not whole data structure.
   an additional param is 'incomplete', a function that is called
   (with rows and header) when data set is truncated by 100 record limit
   */
	this.queryRows = function(parms)
	{
		var callback = parms.callback,
		    incomplete_callback = parms.incomplete || callback;

		function cb(json) {

			var rows = json.records.rows || [],
			    status = json.status[0],
			    header = json.records.header || [];

			if (status === 'complete') {

				callback(rows,header);
			}
			else if (status === 'incomplete') {

				incomplete_callback(rows,header);
			}
		}

		parms.callback = cb;

		return this.query(parms);
	};


 	this._queryByForm = function(parms, dbUrl) 	{

    format = parms.format ? parms.format : format;
		var errback = parms.errback,
		    targetTag = 'upload_target_'+parms.formId+'_'+(SQLEngine.formnamectr+=1),
		    target, action,
        defer = $.Deferred();

		// get form, return if not found
		var $form = $('#'+parms.formId);
		if ( $form.length < 1 )
			return false;

		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}

    // add handlers to deferred
    if ( parms.callback )
      defer.done(parms.callback);
    defer.fail(errback);

    // inner errback
    function results_bad(err,msg) {

      //cleanup_submit(parms.formId);
      defer.reject(err,msg);
    }

    function results_good(json) {

      //cleanup_submit(parms.formId);
      defer.resolve(json);
    }

		// function to handle json when loaded
		function results_loaded(targetTag) {

			var $fr = $(frames[targetTag].document);
			if ($fr.length === 0)
				results_bad('err', 'target "~" iframe document not found'.replace('~',targetTag));

			var cont = $.trim($fr.find('body script').html()),
			    json_result;

			if ( cont ) {
				if ( cont.substr(0,1)==='{' ) {

					if ( parms.plainTextJson ) {
						results_good(cont);
					}
					else {

						try {
							json_result = JSON.parse(cont);
						}
						catch(err) {
							results_bad('err', 'json err: '+err.toString());
							return;
						}
						if (json_result.status[0] === 'error') {
							results_bad(json_result.status[1], json_result.error[1]);
						}
						else {
							results_good(json_result);
						}
					}
				}
				else {
					results_bad('err', 'not json '+cont.substr(0,3));
				}
			}
			else {
				results_bad('err', 'no content');
			}
		}

		// function to cleanup after data received
		function cleanup_submit(formtag) {

			var $form = $('#'+formtag);
			$form.find('.hidden-field-auto').remove();
			$form.attr('target',target);  // restore saved target,action
			$form.attr('action',action);
			remove_iframe(targetTag)
		}

    // save prior values for target and action
		target = $form.attr('target');
		action = $form.attr('action');

		// put password into form
		add_hidden_field($form,'authcode', authcode);

		// set format, action, and target
		add_hidden_field($form,'format',format);
		$form.attr('target',targetTag);
		$form.attr('action',dbUrl);

		// add hidden iframe to end of body
		var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';

		if ( $('#'+targetTag).length === 0 ) {

      // put tagname into iframe txt, and append iframe to body
			iframeTxt = iframeTxt.replace(/~tt~/g,targetTag);
			$('body').append($(iframeTxt));

			// bind action functions to hidden iframe
			$('#'+targetTag).load(function() {

				results_loaded(targetTag);
				cleanup_submit(parms.formId);
			});
		}
    else {
      alert('tag '+targetTag+' iframe already present');
    }

    // change window domain to common-rightmost part of domain
		var winDomain = window.document.domain;
		window.document.domain = this.getCommonDomain();

		return defer.promise();
	};

  /*
   parms is object containing various options
   formId : the id of the form with the data
   callback : function to call with data from successfull query
   errback : function to call with error object from query failure
   plainTextJson : true if JSON parsing to be skipped, in lieu of
   returning the JSON plaintext
   */
  this.queryByForm = function(parms) {

    var dbUrl = this.getQueryUrl();
    return this._queryByForm(parms, dbUrl);
  };


  /* parms is object containing various options
   formId : the id of the form with the data
   callback : function to call with data from successfull query
   errback : function to call with error object from query failure
   plainTextJson : true if JSON parsing to be skipped, in lieu of
   returning the JSON plaintext
   */
	this.loginByForm = function(parms) {

    var dbUrl = this.getLoginUrl();
    return this._queryByForm(parms, dbUrl);

		var target = $form.attr('target'); // save vals
		var action = $form.attr('action');
		var targetTag = 'upload_target'+formId;
  }

} // end of SQLEngine class
SQLEngine.formnamectr = 0;


/*
  following section defines some jQuery plugins

*/

(function ($,window) {

	// default generic callbacks
	//
	function errback(err,msg) {
		alert('<pre>'+err.toString()+': '+msg+'</pre>');
	}

	function dumper(json) {
		var str = JSON.stringify(json,null,4);
		alert(str);
	}

	//  configuration setting function
	//  saves defaults as attribute on the config function
	//
	var opts = {
    errback : errback,
    callback : dumper,
    eachrec : undefined,
    format : 'jsond-easy',
    userName : '',
    authcode : ''        };

	var rdbHostConfig= function (parms) {

		var options = $.extend({}, opts, parms||{});
		rdbHostConfig.opts = options;
	};

	$.rdbHostConfig = rdbHostConfig;  // makes it a plugin


	/*
	    withResults - calls callback with json result object
	      or errback with error object

	    param q : query to get data
	    param callback : function to call with json data
	    param errback : function to call in case of error
	*/
	var withResults = function(parms) {

		assert(arguments.length<=1, 'too many parms to withResults');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode; delete inp.domain;
		return sqlEngine.query(inp);
	};

	$.withResults = withResults;

	/*
	    eachRecord - calls 'eachrec' callback with each record,
	      or errback with error object

	    param q : query to get data
	    param eachrec : function to call with each record
	    param errback : function to call in case of error
	*/
	var eachRecord = function(parms) {

		assert(arguments.length<=1, 'too many parms to eachRecord');
		var eachrec = parms.eachrec;
		delete parms.eachrec;
		assert(eachrec, 'eachrec not provided');

		function cback (json) {

			for (var r in json.records.rows) {
				eachrec(json.records.rows[r]);
			}
		}

		parms.callback = cback;
		return $.withResults(parms);
	};

	$.eachRecord = eachRecord;

	/*
	    postFormData should be used as a submit handler for a data entry form.

	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postFormData = function(that,parms) {

		assert(arguments.length<=2, 'too many parms to postFormData');
		var $form = $(that).closest('form');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		inp.formId = $form.attr('id');
		assert(inp.formId,'form must have a unique id attribute');

    $form.find('#q').remove();
		if (inp.q)
			$form.append($('<input type="hidden" id="q" name="q" >').val(inp.q));

    $form.find('#kw').remove();
		if (inp.kw !== undefined && inp.kw !== null)
			$form.append($('<input type="hidden" id="kw" name="kw" >').val(inp.kw));

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode; delete inp.domain;

    return sqlEngine.queryByForm(inp);
	};

	$.postFormData = postFormData;

	/*
	    postData submits some data (in the options object) to the server
	      and provides the response to callback.

	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postData = function(parms) {

		assert(arguments.length<2, 'too many parms to postData');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});

		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode; delete inp.domain;

		return sqlEngine.query(inp);
	};

	$.postData = postData;


  /*
   rdbhostSubmit is .submit() but waits for cross-domain socket to be ready

   Use in lieu of $('#formid').submit(), where form has been prepared with
   $.postFormData or $.loginByForm

   not necessary for this version of library, but included for completeness
   */
  var rdbhostSubmit = function() {

    this.submit();
  };

  $.fn.rdbhostSubmit = rdbhostSubmit;



  /*
      populateTable creates an html table and inserts into  page

      param q : query to get data
  */
	var populateTable = function(parms) {

		assert(arguments.length<=1, 'too many parms to populateTable');
		var $selset = this;

		if (typeof(parms) === 'string')
			parms = { 'q' : parms };

		function populate_html_table($table,$row,recs) {

			var rec, $newrow;
			$table.find('tbody').empty();

      if (recs === undefined || recs.length === 0) {

        $newrow = $row.clone();
        $table.append($newrow);
      }
      else {

        for (var r in recs) {

          rec = recs[r];
          $newrow = $row.clone().show();
          var ctr = 0, flds = [];

          for (var fname in rec) {

            $newrow.find('td.'+fname).html(rec[fname]);
            ctr += $newrow.find('td.'+fname).length;
            flds.push(fname);
          }

          assert(ctr,'no td elements found with field names! '+flds.join(', '));
          $table.append($newrow);
        }
			}
		}

		function generate_html_table($table,recs) {

			var rec, $row, $td, fld;

			for (var r in recs) {

				rec = recs[r];
				$row = $('<tr>');
				for (var o in rec) {

					fld = rec[o];
					$td = $('<td>').html(fld);
					$row.append($td);
				}

				$table.append($row);
			}
		}

		function cback (json) {

			var recs = json.records.rows;

			$selset.each( function () {

				var $table = $(this);
				assert( !$table.is('form'), 'use .populateForm for forms' );

				if (!$table.is('table')) {

					$table.empty().append('<table><tbody></tbody></table>');
					$table = $table.find('table');
					generate_html_table($table,recs);
				}
				else if ( $table.find('tbody tr:first').length ) {

					var $row = $table.find('tbody tr:first').hide();
					populate_html_table($table,$row,recs);
				}
				else {

					generate_html_table($table,recs);
				}
			});
		}

		parms.callback = cback;
		$.withResults(parms);

		return $selset;
	};

	$.fn.populateTable = populateTable;

	/*
	    populateForm populates a form with a single record

	    param q : query to get data
	*/
	var populateForm = function(parms) {

		assert(arguments.length<=1, 'too many parms to populateForm');
		var $selset = this;

		if (typeof(parms) === 'string')
			parms = { 'q' : parms };

		function populate_form($form,rec) {

			for (var f in rec) {

				var $inp = $form.find('input#'+f);

				if ($inp.length) {

					$inp.val(rec[f]);
				}
				else {
					$inp = $form.find('input.'+f);
					$inp.val(rec[f]);
				}
			}
		}

		function cback (json) {

			if (json.records.rows.length) {

				var rec = json.records.rows[0];
				$selset.each( function () {

					var $form = $(this);
					assert( $form.is('form'), 'use .populateForm on a form' );
					populate_form($form,rec);
				});
			}
		}

		parms.callback = cback;
		$.withResults(parms);

		return $selset;
	};

	$.fn.populateForm = populateForm;

	/*
	    datadump puts a <pre>-formatted json dump into the html

	    param q : query to get data
	    param kw : query-keyword to get data
	*/
	var datadump = function(parms) {

		var $selset = this;

		if (typeof(parms) === 'string')
			parms = { 'q' : parms };

		function cback (json) {

			$selset.each( function () {

				$(this).html(JSON.stringify(json,null,4)); // 4 space indent
			});
		}

		parms.callback = cback;
		$.withResults(parms);

		return $selset;
	};

	$.fn.datadump = datadump;

}(jQuery,this));


/* create assert function
  example : assert( obj === null, 'object was not null!' );
  error message appears in javascript console, if any.
  credit to: Ayman Hourieh http://aymanh.com/
*/
function AssertException(message) { this.message = message; }
AssertException.prototype.toString = function () {
  return 'AssertException: ' + this.message;
};
function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}

