// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.provide("frappe.ui.form");

frappe.ui.form.Attachment = Class.extend({
	init: function(opts) {
		$.extend(this, opts);
		this.make();
		this.dialog_attachments=[]
		this.new_dialog=[]
		this.final_dialog=[]
	},
	make: function() {
		var me = this;
		this.parent.find(".add-attachment").click(function() {
			me.new_attachment();
		});
		this.add_attachment_wrapper = this.parent.find(".add_attachment").parent();
		this.attachments_label = this.parent.find(".attachments-label");
	},
	refresh: function() {
		var me = this;

		this.parent.toggle(true);
		this.parent.find(".attachment-row").remove();

		// add attachment objects
		var attachments = this.get_attachments();
		if(attachments.length) {
			attachments.forEach(function(attachment) {
				me.add_attachment(attachment)
			});
		} else {
			this.attachments_label.removeClass("has-attachments");
		}

	},
	get_attachments: function() {
		return this.dialog_attachments

	},
	add_attachment: function(attachment) {

		var file_name = attachment.file_name;
		var file_url = this.get_file_url(attachment);
		var fileid = attachment.name;
		if (!file_name) {
			file_name = file_url;
		}

		var me = this;

		var $attach = $(repl('<li class="attachment-row">\
				<a href="%(file_url)s" target="_blank" title="%(file_name)s" \
					class="text-ellipsis" style="max-width: calc(100% - 43px);">\
					<span>%(file_name)s</span></a><a class="attachment_close" style="float:"";padding-left:1px" data-owner="%(owner)s">×</a>\
			</li>', {
				file_name: file_name,
				file_url: frappe.urllib.get_full_url(file_url)
			}))
			.insertAfter(this.attachments_label.addClass("has-attachments"));

		$(".attachment_close").css({"font-size":"15px","padding-left":"10px","font-weight":"bold",
									"line-height": "1","color": "#000","opacity":"2"})
		var $close =
			$attach.find(".attachment_close")
			.data("fileid", fileid)
			.click(function() {
				var remove_btn = this;
				frappe.confirm(__("Are you sure you want to delete the attachment?"),
					function() {
						me.remove_attachment($(remove_btn).data("fileid"))
					}
				);
				return false
			});

	},
	get_file_url: function(attachment) {
		
		var file_url = attachment.file_url;
		if (!file_url) {
			if (attachment.file_name.indexOf('files/') === 0) {
				file_url = '/' + attachment.file_name;
			}
			else {
				file_url = '/files/' + attachment.file_name;
			}
		}
		// hash is not escaped, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI
		return encodeURI(file_url).replace(/#/g, '%23');
	},
	get_file_id_from_file_url: function(file_url) {
		var fid;
		$.each(this.get_attachments(), function(i, attachment) {
			if (attachment.file_url === file_url) {
				fid = attachment.name;
				return false;
			}
		});
		return fid;
	},
	remove_attachment_by_filename: function(filename, callback) {
		this.remove_attachment(this.get_file_id_from_file_url(filename), callback);
	},
	remove_attachment: function(fileid, callback) {
		if (!fileid) {
			if (callback) callback();
			return;
		}

		var me = this;
		return frappe.call({
			method: 'mailbox.mailbox.doctype.mailbox.upload.remove_attach',
			args: {
				fid: fileid,
				dt: 'Compose',
				dn: fileid
			},
			callback: function(r,rt) {
				if(r.exc) {
					if(!r._server_messages)
						msgprint(__("There were errors"));
					return;
				}
				me.remove_fileid(fileid);
				if (callback) callback();
			}
		});
	},
	new_attachment: function(fieldname) {
		var me = this;
		if(!this.dialog) {
			this.dialog = new frappe.ui.Dialog({
				title: __('Upload Attachment'),
			});
		}
		this.dialog.show();
		this.fieldname = fieldname;

		$(this.dialog.body).empty();
		frappe.upload.make({
			parent: this.dialog.body,
			args: this.get_args(),
			callback: function(attachment, r) {
				me.attachment_uploaded(attachment, r);
				
			},
			onerror: function() {
				me.dialog.hide();
			},
			btn: this.dialog.set_primary_action(__("Attach")),
			
		});
	},
	get_args: function() {
		return {
			method:"mailbox.mailbox.doctype.mailbox.upload.upload",
			ref_no:this.ref_no
		}
	},
	attachment_uploaded:  function(attachment, r) {
		this.dialog && this.dialog.hide();
		this.update_attachment(attachment, r.message.comment);
	},
	update_attachment: function(attachment, comment) {
		var me = this; 
		frappe.call({
			method: 'mailbox.mailbox.doctype.mailbox.upload.get_attachments',
			args: {
				ref_no:this.ref_no
			},
			callback: function(r,rt) {
				me.dialog_attachments.push(r.message[0])
				me.refresh();
			}
		})
		
	},
	add_to_attachments: function (attachment) {
		var form_attachments = this.get_attachments();
		for(var i in form_attachments) {
			// prevent duplicate
			if(form_attachments[i]["name"] === attachment.name) return;
		}
		form_attachments.push(attachment);
	},
	remove_fileid: function(fileid) {
		var attachments = this.get_attachments();
		var new_attachments = [];

		$.each(attachments, function(i, attachment) {
			if(attachment.name!=fileid) {
				new_attachments.push(attachment);
			}
		});
		this.dialog_attachments = new_attachments;
		this.refresh();
	}
});
