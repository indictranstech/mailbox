frappe.provide("mailbox")
{% include 'mailbox/mailbox/doctype/mailbox/attachments.js' %};
mailbox.Composer = Class.extend({
	init: function(opts) {
		$.extend(this, opts);
		this.make()
		this.fetch_name()
	},
	make: function() {
		var me = this;
		this.dialog = new frappe.ui.Dialog({
			title: __("Compose"),
			no_submit_on_enter: true,
			fields: [
				{label:__("From"), fieldtype:"Select",fieldname:"sender","option":""},
				{label:__("To"), fieldtype:"Data", reqd: 1, fieldname:"recipient"},
				{label:__("Hide/Unhide"), fieldtype:"HTML",
					fieldname:"hide"},
				{fieldtype: "Section Break","name":"cc_sec"},
				{label:__("CC"), fieldtype:"Data", fieldname:"cc"},
				{label:__("BCC"), fieldtype:"Data", fieldname:"bcc"},

				{fieldtype: "Section Break"},
				{label:__("Subject"), fieldtype:"Data", reqd: 1,
					fieldname:"subject"},

				{fieldtype: "Section Break"},
				{label:__("Tag"), fieldtype:"Link", fieldname:"tag","options":"Tag"},
				{fieldtype: "Column Break"},
				{label:__("Customer"), fieldtype:"Link", fieldname:"customer","options":"Customer"},
				{fieldtype: "Column Break"},
				{label:__("Supplier"), fieldtype:"Link", fieldname:"supplier","options":"Supplier"},
						
				{fieldtype: "Section Break"},
				{label:__("Message"), fieldtype:"Text Editor", reqd: 1,
					fieldname:"content"},

				{fieldtype: "Section Break"},
				{fieldtype: "Column Break"},
				{label:__("Send As Email"), fieldtype:"Check",
					fieldname:"send_email","default":1},
					
				{label:__("Select Attachments"), fieldtype:"HTML",
					fieldname:"select_attachments"}
				
			],
			primary_action_label: "Send",
			primary_action: function() {
				me.send_action();
			}
		});

		this.prepare();
		this.dialog.show();
	},

	fetch_name:function(){
		var me=this;
		$( $(this.dialog.fields_dict.recipient.input)).autocomplete({
   			 select: function( event, ui ) {

   			 	me.read_customer_supplier_name(ui.item.value) 	
   			},
   			change: function(event,ui){
   				$(me.dialog.fields_dict.supplier.input).val('')
   				me.read_customer_supplier_name($(this).val())
   			}

		});		
	},

	read_customer_supplier_name:function(emailid){
		var me=this;
		$(me.dialog.fields_dict.customer.input).val('')
   		$(me.dialog.fields_dict.supplier.input).val('')
		frappe.call({

			method: "mailbox.mailbox.doctype.email_contacts.email_contacts.get_customer_supplier_name",
			args: {
				"email_id": emailid
			},
			callback: function(r) {
				if(r.message){
					if (r.message['customer_name'])
						$(me.dialog.fields_dict.customer.input).val(r.message['customer_name'])
					else
						$(me.dialog.fields_dict.supplier.input).val(r.message['supplier_name'])
				}
			}						
		});

	},

	prepare: function() {
		var me = this;
		var fields = this.dialog.fields_dict;

		$(this.dialog.fields_dict.customer.input).attr('disabled',true)
		$(this.dialog.fields_dict.supplier.input).attr('disabled',true)

		if (this.action != 'compose'){
			this.setup_subject_and_recipients();
			this.setup_attach();
			//this.setup_email();
			this.setup_earlier_reply();
			$($(fields.sender.wrapper)).addClass('hide')
		}
		else if (this.action == 'compose'){
			$(this.dialog.fields_dict.sender.input).attr('required',true)
			this.setup_link()
			this.attachments_for_compose();
		}	
		this.setup_autosuggest();
		this.setup_hide_unhide();
		$(this.dialog.fields_dict.recipient.input).val(this.recipient || "").change();
		$(this.dialog.fields_dict.subject.input).val(this.subject || "").change();
	},
	setup_link:function(){
		var me = this;
		frappe.call({
			method: "mailbox.mailbox.doctype.mailbox.mailbox.get_emails",
			callback: function(r) {
				if (r.message){
					sender = me.dialog.fields_dict.sender.wrapper
					$.each(r.message, function(value,key) {
					  $(sender).find('select').append($("<option></option>")
					     .attr("value", key).text(key));
					});
				}
			}	
			
		})
	},
	attachments_for_compose:function(){
		var me = this;
		var fields = this.dialog.fields_dict;
		var attach = $(fields.select_attachments.wrapper);
		$('<ul class="list-unstyled sidebar-menu form-attachments">\
			<li class="divider"></li> <li class="h6 attachments-label">Attachments</li>\
			<li class="divider"></li> <li><a class="strong add-attachment">Attach File \
			<i class="octicon octicon-plus" style="margin-left: 2px;"></i></a></li></ul>').appendTo(attach)

		this.attachments = new frappe.ui.form.Attachment({
			parent : attach,
			frm : this.dialog,
			ref_no : me.ref_no
		});
	},
	setup_hide_unhide:function(){
		var me = this;
		var fields = this.dialog.fields_dict;
		var attach = $(fields.hide.wrapper);
		$($(fields.cc.wrapper).parent().parents()[2]).addClass('hide')
		$('<a class="strong"><u>Show/Hide CC,BCC</u></a>').appendTo(attach).bind('click',function(){
			$($(fields.cc.wrapper).parent().parents()[2]).toggleClass('hide')
		})		
	},
	setup_subject_and_recipients :function() {
        
		this.subject = "";
		this.recipients = "";

		if(this.action == 'reply') {
			$(this.dialog.fields_dict.recipient.input).attr('disabled',true)
			this.recipient = this.doc.sender
		}

		if (this.action == 'reply_all'){
			var me = this; 
			$(this.dialog.fields_dict.recipient.input).attr('disabled',true)
			this.recipient = this.doc.sender
			$(this.dialog.fields_dict.cc.input).attr('disabled',true)
			$(me.dialog.fields_dict.cc.input).val(this.doc.cc)
			
		}
		
		if(!this.subject && this.frm) {
			// get subject from last communication
			if(this.action == 'reply') {
				this.subject = this.doc.subject;
				if(!this.recipient) {
					this.recipient = this.doc.sender;
				}
				// prepend "Re:"
				if(strip(this.subject.toLowerCase().split(":")[0])!="re") {
					this.subject = "Re: " + this.subject;
				}
			}
			if(this.action == 'forward') {
				this.subject = this.doc.subject;
				// prepend "Fwd:"
				if(strip(this.subject.toLowerCase().split(":")[0])!="fwd") {
					this.subject = "Fwd: " + this.subject;
				}
			}

			if (!this.subject) {
				this.subject = __(this.frm.doctype) + ': ' + this.frm.docname;
			}
		}
	},
	setup_attach :function() {
		if (!this.frm) return;

		var fields = this.dialog.fields_dict;
		var attach = $(fields.select_attachments.wrapper);

		var files = this.frm.get_files();
		if(files.length) {
			$("<h6 class='text-muted' style='margin-top: 12px;'>"
				+__("Add Attachments")+"</h6>").appendTo(attach.empty());
			$.each(files, function(i, f) {
				if (!f.file_name) return;
				f.file_url = frappe.urllib.get_full_url(f.file_url);

				$(repl('<p class="checkbox">'
					+	'<label><span><input type="checkbox" data-file-name="%(name)s"></input></span>'
					+		'<span class="small">%(file_name)s</span>'
					+	' <a href="%(file_url)s" target="_blank" class="text-muted small">'
					+		'<i class="icon-share" style="vertical-align: middle; margin-left: 3px;"></i>'
					+ '</label></p>', f))
					.appendTo(attach)
			});
		}
	},
	send_action: function() {
		var me = this,
		form_values = me.dialog.get_values(),
		btn = me.dialog.get_primary_btn();
		if(!form_values) return;
		if (this.action == 'compose'){
			if ($(me.dialog.fields_dict.sender.input).val() !=''){
				me.send_email(btn, form_values);
			}
			else{
				msgprint(__("Missing Values 'From'"))
			}
		}
		else{
			var selected_attachments = $.map($(me.dialog.wrapper)
			.find("[data-file-name]:checked"), function(element) {
				return $(element).attr("data-file-name");
			})
			me.send_email(btn, form_values, selected_attachments);	
		}
		//}
	}/*,
	send_new_email: function(btn, form_values, selected_attachments) {
		var me = this;
		return frappe.call({
			method:"mailbox.mailbox.doctype.mailbox.mailbox.make",
			args: {
				recipients: form_values.recipient,
				subject: form_values.subject,
				content: form_values.content,
				send_email: form_values.send_email,
				ref_no:this.ref_no,
				action:this.action,
				cc:form_values.cc,
				bcc:form_values.bcc,
				form_values:form_values
			},
			btn: btn,
			callback: function(r) {
				if(!r.exc) {
					if (!r.message.not_valid){
						if(form_values.send_email && r.message["recipients"])
							msgprint(__("Email sent to {0}", [r.message["recipients"]]));
						me.dialog.hide();
					}
					else{
						msgprint(__("Recipients Not Valid"));	
					}	
				} else {
					msgprint(__("There were errors while sending email. Please try again."));
				}
			}
		});
	}*/,
	send_email :function(btn, form_values, selected_attachments) {
		var me = this;
		return frappe.call({
			method:"mailbox.mailbox.doctype.mailbox.mailbox.make",
			args: {
				recipients: form_values.recipient,
				sender: form_values.sender,
				subject: form_values.subject,
				content: form_values.content,
				doctype: this.doc ? this.doc.doctype:"",
				name:  this.doc ? this.doc.name:"",
				send_email: form_values.send_email,
				attachments: selected_attachments,
				email_account:me.doc ? me.doc.email_account:"",
				doc:me.doc,
				cc:form_values.cc,
				bcc:form_values.bcc,
				action:this.action,
				form_values:form_values,
				ref_no:this.ref_no,
				
			},
			btn: btn,
			callback: function(r) {
				if(!r.exc) {
					if (!r.message.not_valid){
						if(form_values.send_email && r.message["recipients"])
							msgprint(__("Email sent to {0}", [r.message["recipients"]]));
						me.dialog.hide();
						refresh_field("tag")
					}
					else{
						msgprint(__(r.message.not_valid));	
					}
					
				} else {
					msgprint(__("There were errors while sending email. Please try again."));
				}
			}
		});
	},
	setup_autosuggest : function() {
		var me = this;

		function split( val ) {
			return val.split( /,\s*/ );
		}
		function extractLast( term ) {
			return split(term).pop();
		}
		fields_dict = this.dialog.fields_dict
		fields = [fields_dict.recipient.input,fields_dict.cc.input,fields_dict.bcc.input]
		$(fields)
			.bind( "keydown", function(event) {
				if (event.keyCode === $.ui.keyCode.TAB &&
						$(this).data( "autocomplete" ) &&
						$(this).data( "autocomplete" ).menu.active ) {
					event.preventDefault();
				}
			})
			.autocomplete({
				source: function(request, response) {
					return frappe.call({
						method:'frappe.email.get_contact_list',
						args: {
							'select': "email_address",
							'from': "Email Contacts",
							'where': "account_type",
							'txt': 'User' || '%'
						},
						quiet: true,
						callback: function(r) {
							response($.ui.autocomplete.filter(
								r.cl || [], extractLast(request.term)));
						}
					});
				},
				appendTo: this.dialog.$wrapper,
				focus: function() {
					// prevent value inserted on focus
					return false;
				},
				select: function( event, ui ) {
					var terms = split( this.value );
					// remove the current input
					terms.pop();
					// add the selected item
					terms.push( ui.item.value );
					// add placeholder to get the comma-and-space at the end
					//terms.push( "" );
					if ($(this).attr('data-fieldname') != 'recipient'){
						terms.push( "" );
						this.value = terms.join( ", " );
					}
					else {
						this.value = terms
					}	
					return false;
				}
			});
	},
	setup_earlier_reply : function() {
		var fields = this.dialog.fields_dict,
		signature = frappe.boot.user.email_signature || "";
		

		if(!frappe.utils.is_html(signature)) {
			signature = signature.replace(/\n/g, "<br>");
		}

		if(this.txt) {
			this.message = this.txt + (this.message ? ("<br><br>" + this.message) : "");
		}

		if(this.real_name) {
			this.message = '<p>'+__('Dear') +' '
				+ this.real_name + ",</p>" + (this.message || "");
		}

		var reply = (this.message || "")
			+ (signature ? ("<br>" + signature) : "");

		if(this.action == 'reply') {
			//var last_email_content = last_email.original_comment || last_email.comment;
			var last_email_content = this.doc.content;
			fields.content.set_input(reply
				+ "<br><!-- original-reply --><br>"
				+ '<blockquote>' +
					'<p>' + __("On {0}, {1} wrote:",
					[frappe.datetime.global_date_format(this.doc.creation) , this.doc.sender]) + '</p>' +
					last_email_content +
				'<blockquote>');
		}
		if(this.action == 'forward') {
			//var last_email_content = last_email.original_comment || last_email.comment;
			var last_email_content = this.doc.content;
			fields.content.set_input(reply
				+ "<br>------ Forwarded message--------<br>"
				+ '<p>' + __("From: {0} \< {1} \><br>Date:{2}<br>Subject:{3}<br>To:{4}",
					[this.doc.sender_full_name,this.doc.sender,frappe.datetime.global_date_format(this.doc.creation),this.doc.subject,this.doc.recipients]) + '</p>' +
					last_email_content);
		} 
	}
});
