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


def validate_assigning_customers(doc,method):
	if doc.customer_name and doc.supplier_name:
		frappe.msgprint("Sorry, We can not set same contact for Customer and Supplier also",raise_exception=1)


@frappe.whitelist()
def get_customer_supplier_name(email_id=None):
	customer_name=frappe.db.get_value('Contact',{"email_id":email_id},"customer_name")
	supplier_name=frappe.db.get_value('Contact',{"email_id":email_id},"supplier_name")

	if customer_name:
		return {
		"customer_name":customer_name
		}
	elif supplier_name:
		return {
		"supplier_name":supplier_name
		}


