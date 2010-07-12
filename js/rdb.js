// sun 12:05

// to add hidden field to form
function add_hidden_field($form,nm,val) {
	var fld = $('<input type="hidden" class="to-remove-later" />');
	fld.attr('name',nm).val(val);
	$form.append(fld);
};


// SQL Engine that uses form for input, and hidden iframe for response
//   handles file fields 
//
function SQLEngine(uName,authcode,subdomain)
{
	// store engine config info
	this.format = 'json';
	this.userName = uName;
	this.authcode = authcode;
	this.subdomain = subdomain || 'rdbhost';
	this.formnamectr = 0;
	
	this.getQueryUrl = function(altPath) {
		var proto = window.location.protocol;
		var hparts = window.location.hostname.split('.').slice(-2);
		hparts.unshift(this.subdomain);
		if (!altPath) altPath = '/db/'+this.userName;
		return proto+'//'+hparts.join('.')+altPath;
	}
	this.getLoginUrl = function() {
		return this.getQueryUrl('/mbr/login');
	}
	this.getCommonDomain = function() {
		var hparts = window.location.hostname.split('.').slice(-2);
		return hparts.join('.');
	}

	this.query = function(parms) //callback,errback,query,args,argtypes)
	/* parms is object containing various options
	    callback : function to call with data from successfull query
	    errback : function to call with error object from query failure
  	    q : the query string itself
	    args : array of arguments (optional), must correspond with %s tokens
	          in query
	    argtypes : array of python DB API types, one per argument
	    plainTextJson : true if JSON parsing to be skipped, in lieu of
	             returning the JSON plaintext
	*/
	{
		var callback = parms['callback'];
		var errback = parms['errback'];
		var query = parms['q'];
		var kw = parms['kw'];
		var args = parms['args'] || [];
		var argtypes = parms['argtypes'] || [];
		var plainText = parms['plainTextJson'];
		
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			}
		}
		// local callbacks to do cleanup prior to 'real' callback
		function qErrback(err,msg) {
			// if frame loaded by 'back button', skip over it
			if (!iframe_requested)
				parent.history.back();
			iframe_requested = false;
			$hiddenform.remove();
			errback(err,msg);
		}
		function qCallback(json) {
			// if frame loaded by 'back button', skip over it
			if (!iframe_requested)
				parent.history.back();
			iframe_requested = false;
			$hiddenform.remove();
			callback(json);
		}
		var $this = this;
		// create hidden form if necessary
		var formId = 'rdb_hidden_form_rdb_hidden_form_rdb'+(++$this.formnamectr);
		var $hiddenform = $('#'+formId);
		var iframe_requested = false;
		if ( $hiddenform.length < 1 ) {
			var $newform = $(('<form method="post" name="~~id~~" id="~~id~~"'+
							  ' enctype="multipart/form-data" style="display:none">'+
							  ' </form>').replace(/~~id~~/g,formId));
			$('body').append($newform);
			$hiddenform = $('#'+formId);
		}
		// put query in hidden form
		add_hidden_field($hiddenform,'q',query);
		add_hidden_field($hiddenform,'kw',kw);
		// if params are provided, convert to named form 'arg000', 'arg001'...
		if (args != undefined) {
			for ( var i=0; i<args.length; i++ ) {
				var num = '000'+i;
				var nm = 'arg'+num.substr(num.length-3);
				add_hidden_field($hiddenform,nm,args[i]);
			}
		}
		// remove submit handler, if one already, and bind new handler
		$hiddenform.unbind('submit');
		$hiddenform.submit(function () {
			iframe_requested = true;
			var res = $this.queryByForm({ 'formId' : formId,
										  'callback' : qCallback,
										  'errback' : qErrback,
										  'plainTextJson' : plainText });
			return res;
		});
		// submit the hidden form
		$hiddenform.submit();
	};
	
	
	this.queryRows = function(parms)
	/* parms is just like query, but callback gets row array, and header dict
	   not whole data structure
	*/
	{
		function cb(json) {
			var rows = json.records.rows || [];
			var header = json.records.header || [];
			callback(rows,header);
		}
		var callback = parms['callback'];
		parms['callback'] = cb;
		this.query(parms)
	};
	
	
	this.queryByForm = function(parms)
	/* parms is object containing various options
  	    formId : the id of the form with the data
	    callback : function to call with data from successfull query
	    errback : function to call with error object from query failure
	    plainTextJson : true if JSON parsing to be skipped, in lieu of
	             returning the JSON plaintext
	*/
	{
		var callback = parms['callback'];
		var errback = parms['errback'];
		var formId = parms['formId'];
		var plainTextJson = parms['plainTextJson'];
		
		var $this = this;
		var targettag = 'upload_target'+formId;
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		};
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			}
		}

		// function to handle json when loaded		
		function results_loaded(callback,errback) {
			//
			var $fr = $(frames[targettag].document);
/*			alert('frame domain: '+frames[targettag].document.domain);
			try {
				frames[targettag].document.domain = $this.getCommonDomain();
				alert('frame domain: '+frames[targettag].document.domain);
			}
			catch (err) {
				if ( /not set property 'dom/i.test(err.toString()) ) {
					errback('iframe error: check that format is "jsond" '+
							'and subdomain is set or "rdbhost"');
					return;
				}
				else {
					errback('iframe error: '+err.toString());
					return;
				}
			}
*/			if ($fr.length === 0) alert('target "~" iframe document not found'
									     .replace('~',targettag));
			var cont = $.trim($fr.find('body script').html());
			var json_result, stat;
			if ( cont ) {
				//cont = cont.replace(/^\s*<pr[^>]+>/i,''); // remove opening pre
				//cont = cont.replace(/<[/]pr[^>]+\s*>$/i,''); // remove end pre
				if (cont.substr(0,1)==='{') {
					if ( plainTextJson ) {
						callback(cont);
					}
					else {
						try {
							json_result = JSON.parse(cont);
						}
						catch(err) {
							errback('json err: '+err.toString());
							return;
						}
						if (json_result.status[0] === 'error') {
							errback(json_result.status[1],json_result.error[1]);
						}
						else {
							callback(json_result);
						};
					}
				}
				else {
					errback('not json '+cont.substr(0,3));
				}
			}
			else {
				errback('no content');
			}
		}
		// function to cleanup after data recieved
		function cleanup_submit(formtag) {
			var $form = $('#'+formtag);
			$form.find('.to-remove-later').remove();
			$form.attr('target',target);  // restore saved target,action
			$form.attr('action',action);
			$('#'+targettag).remove();
		};
		// init vars
		var dbUrl =  this.getQueryUrl(); 
		//dbUrl = "http://rdbhost.paginaswww.com/helloalert.html";
		var target = $form.attr('target'); // save vals
		var action = $form.attr('action');
		// put password into form
		add_hidden_field($form,'authcode', this.authcode);
		// set format, action, and target
		add_hidden_field($form,'format','jsond');
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);
		// add hidden iframe to end of body
		var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';
		if ( $('#'+targettag).length === 0 ) {
			iframeTxt = iframeTxt.replace(/~tt~/g,targettag);
			$('body').append($(iframeTxt));
			// bind action functions to hidden iframe
			$('#'+targettag).load(function() {
				results_loaded(callback,errback);
				cleanup_submit(formId);
			});
		}
		var winDomain = window.document.domain;
		window.document.domain = this.getCommonDomain();
		//alert('new windocdom: '+window.document.domain);
		return true;
	};

	this.login = function(email,passwd)
	/*
	   logs in with email and password.  If on www.rdbhost.com and user logged
	   in to rdbhost account, email/password are optional.
	*/
	{
		var stat;
        var jsloginUrl = this.getLoginUrl();
		alert('jsLogin url: '+jsloginUrl);

		$.ajax({type: "POST",
				url: jsloginUrl,
				async: false,
                data: {'password' : passwd,
				       'email' : email },
                dataType: "json",
                success: function(d)
                {
                	if (d == null || d == '' || d == undefined) {
                		alert('login failed: timeout');
						stat = false;
                	}
                	else if (d['status'][0] == 'error') {
                		alert('login db failed: '+d['status'][1]);
						stat = false;
                	}
                	else if (d['status'][0] == 'complete') {
						stat = d['roles'];
                	}
                	else {
                		alert('wonkers! status: '+d['status'][0]);
						stat = false;
                	}
                },
                error: function(xhr,errtype,exc)
                {
                	// set page location elsewhere
                	alert('login connect failed: '+errtype)
					stat = false;
                }
		});
		return stat;
	};


/* loginByForm on hold pending decision on how to accomodate https/http
   consistency requirement.
*/

	this.loginByForm = function(parms)
	/* parms is object containing various options
  	    formId : the id of the form with the data
	    callback : function to call with data from successfull query
	    errback : function to call with error object from query failure
	    plainTextJson : true if JSON parsing to be skipped, in lieu of
	             returning the JSON plaintext
	*/
	{
		var callback = parms['callback'];
		var errback = parms['errback'];
		var formId = parms['formId'];
		var plainTextJson = parms['plainTextJson'];
		
		var $this = this;
		var targettag = 'upload_target'+formId;
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		};
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			}
		}
		// function to handle json when loaded		
		function results_loaded(callback,errback) {
			//
			var $fr = $(frames[targettag].document);
			if ($fr.length === 0) alert('target "~" iframe document not found'
									     .replace('~',targettag));
			var cont = $.trim($fr.find('body script').html());
			var json_result, stat;
			if ( cont ) {
				if (cont.substr(0,1)==='{') {
					if ( plainTextJson ) {
						callback(cont);
					}
					else {
						try {
							json_result = JSON.parse(cont);
						}
						catch(err) {
							errback('json err: '+err.toString());
							return;
						}
						if (json_result.status[0] === 'error') {
							errback(json_result.status[1],json_result.error[1]);
						}
						else {
							callback(json_result);
						};
					}
				}
				else {
					errback('not json '+cont.substr(0,3));
				}
			}
			else {
				errback('no content');
			}
		}
		// function to cleanup after data recieved
		function cleanup_submit(formtag) {
			var $form = $('#'+formtag);
			$form.find('.to-remove-later').remove();
			$form.attr('target',target);  // restore saved target,action
			$form.attr('action',action);
			$('#'+targettag).remove();
		};
		// init vars
		var dbUrl =  this.getLoginUrl(); 
		var target = $form.attr('target'); // save vals
		var action = $form.attr('action');
		// set format, action, and target
		add_hidden_field($form,'format','jsond');
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);
		// add hidden iframe to end of body
		var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';
		if ( $('#'+targettag).length === 0 ) {
			iframeTxt = iframeTxt.replace(/~tt~/g,targettag);
			$('body').append($(iframeTxt));
			// bind action functions to hidden iframe
			$('#'+targettag).load(function() {
				results_loaded(callback,errback);
				cleanup_submit(formId);
			});
		}
		var winDomain = window.document.domain;
		window.document.domain = this.getCommonDomain();
		//alert('new windocdom: '+window.document.domain);
		return true;
	};
	
} // end of SQLEngine class


