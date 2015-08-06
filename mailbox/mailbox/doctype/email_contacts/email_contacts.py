# -*- coding: utf-8 -*-
# Copyright (c) 2015, New Indictrans Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class EmailContacts(Document):
	pass

def validate_emailid(doc,method):
	if frappe.db.sql(""" select name from `tabContact` where name!='%s' and email_id='%s' """%(doc.name,doc.email_id)):
		frappe.msgprint("Specified Emailid '%s' is already assigned for another contacts"%doc.email_id,raise_exception=1)