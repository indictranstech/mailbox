frappe.ui.form.on("Email Account Config", {
	email_id: function(frm) {
		if(!frm.doc.email_account_name) {
			frm.set_value("email_account_name",toTitle(frm.doc.email_id.split("@")[0].replace(/[._]/g, " ")));
		}
	}
});